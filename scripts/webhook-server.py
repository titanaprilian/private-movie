#!/usr/bin/env python3
"""
Lightweight webhook listener for continuous deployment on NAT VPS.
Receives authenticated POST requests and triggers scripts/deploy.sh in the background.
Supports non-blocking async execution and /deploy-status polling to prevent HTTP timeouts.
Zero external dependencies (uses standard library Python 3).
"""

import hmac
import json
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "9000"))
SECRET = os.environ.get("DEPLOY_WEBHOOK_SECRET", "")
BASE_DIR = Path(__file__).resolve().parent.parent
DEPLOY_SCRIPT = BASE_DIR / "scripts" / "deploy.sh"

lock = threading.Lock()
deployment_state = {
    "status": "idle",  # "idle" | "running" | "success" | "error"
    "deployment_id": 0,
    "services": [],
    "started_at": 0,
    "completed_at": 0,
    "returncode": None,
    "output": "",
}


def run_deployment_worker(services: list, dep_id: int):
    global deployment_state
    cmd = [str(DEPLOY_SCRIPT)] + services
    sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [Worker] Executing: {' '.join(cmd)}\n")

    try:
        result = subprocess.run(
            cmd,
            cwd=str(BASE_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
            timeout=600,
        )
        with lock:
            if deployment_state["deployment_id"] == dep_id:
                deployment_state["completed_at"] = time.time()
                deployment_state["returncode"] = result.returncode
                deployment_state["output"] = result.stdout or ""
                deployment_state["status"] = "success" if result.returncode == 0 else "error"
        sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [Worker] Finished with code {result.returncode}\n")
    except subprocess.TimeoutExpired:
        with lock:
            if deployment_state["deployment_id"] == dep_id:
                deployment_state["completed_at"] = time.time()
                deployment_state["returncode"] = 124
                deployment_state["output"] = "Deployment script timed out after 600s"
                deployment_state["status"] = "error"
        sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [Worker] Timed out\n")
    except Exception as exc:
        with lock:
            if deployment_state["deployment_id"] == dep_id:
                deployment_state["completed_at"] = time.time()
                deployment_state["returncode"] = 1
                deployment_state["output"] = f"Internal worker error: {exc}"
                deployment_state["status"] = "error"
        sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [Worker] Exception: {exc}\n")


class WebhookHandler(BaseHTTPRequestHandler):
    server_version = "WebhookServer/2.0"

    def log_message(self, format_str, *args):
        sys.stderr.write(f"[{self.log_date_time_string()}] {format_str % args}\n")

    def send_json(self, status_code: int, data: dict):
        response = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def is_authorized(self) -> bool:
        if not SECRET:
            return False
        token = self.headers.get("X-Deploy-Token")
        if not token:
            auth_header = self.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:].strip()
        return bool(token and hmac.compare_digest(token, SECRET))

    def do_GET(self):
        clean_path = self.path.split("?")[0].rstrip("/")
        if clean_path in ("/healthz", "/health"):
            self.send_json(200, {"status": "ok", "service": "deploy-webhook"})
            return

        if clean_path in ("/deploy-status", "/hooks/deploy/status"):
            if not self.is_authorized():
                self.send_json(401, {"error": "Unauthorized"})
                return
            with lock:
                data = dict(deployment_state)
            self.send_json(200, data)
            return

        self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        clean_path = self.path.split("?")[0].rstrip("/")
        if clean_path not in ("/deploy-webhook", "/hooks/deploy"):
            self.send_json(404, {"error": "Not found"})
            return

        # 1. Authenticate
        if not SECRET:
            self.log_message("DEPLOY_WEBHOOK_SECRET environment variable is not configured!")
            self.send_json(500, {"error": "Server misconfigured: DEPLOY_WEBHOOK_SECRET is empty"})
            return

        if not self.is_authorized():
            self.log_message("Unauthorized webhook attempt rejected.")
            self.send_json(401, {"error": "Unauthorized"})
            return

        # 2. Check if deployment already running
        with lock:
            if deployment_state["status"] == "running":
                self.send_json(409, {
                    "status": "running",
                    "error": "Deployment already in progress",
                    "deployment_id": deployment_state["deployment_id"],
                })
                return

            # 3. Parse services
            content_length = int(self.headers.get("Content-Length", 0))
            payload = {}
            if content_length > 0:
                try:
                    body = self.rfile.read(content_length)
                    payload = json.loads(body.decode("utf-8"))
                except Exception as exc:
                    self.log_message(f"Warning: could not parse JSON body: {exc}")

            raw_services = payload.get("services", "")
            if isinstance(raw_services, list):
                services = [str(s).strip() for s in raw_services if str(s).strip()]
            elif isinstance(raw_services, str) and raw_services.strip():
                services = raw_services.strip().split()
            else:
                services = ["backend", "web"]

            allowed = {"backend", "web"}
            sanitized_services = [s for s in services if s in allowed]
            if not sanitized_services:
                sanitized_services = ["backend", "web"]

            new_id = deployment_state["deployment_id"] + 1
            deployment_state.update({
                "status": "running",
                "deployment_id": new_id,
                "services": sanitized_services,
                "started_at": time.time(),
                "completed_at": 0,
                "returncode": None,
                "output": "",
            })

        # 4. Spawn background worker
        t = threading.Thread(
            target=run_deployment_worker,
            args=(sanitized_services, new_id),
            daemon=True,
        )
        t.start()

        self.log_message(f"Deployment #{new_id} queued for {sanitized_services}.")
        self.send_json(202, {
            "status": "accepted",
            "deployment_id": new_id,
            "services": sanitized_services,
            "message": "Deployment queued in background",
        })


def run():
    if not SECRET:
        sys.stderr.write("WARNING: DEPLOY_WEBHOOK_SECRET environment variable is not set!\n")

    server_address = (HOST, PORT)
    httpd = HTTPServer(server_address, WebhookHandler)
    print(f"Webhook listener v2 running on http://{HOST}:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()


if __name__ == "__main__":
    run()
