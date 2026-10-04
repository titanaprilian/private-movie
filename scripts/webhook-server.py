#!/usr/bin/env python3
"""
Lightweight webhook listener for continuous deployment on NAT VPS.
Receives authenticated POST requests and triggers scripts/deploy.sh.
Zero external dependencies (uses standard library Python 3).
"""

import hmac
import json
import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "9000"))
SECRET = os.environ.get("DEPLOY_WEBHOOK_SECRET", "")
BASE_DIR = Path(__file__).resolve().parent.parent
DEPLOY_SCRIPT = BASE_DIR / "scripts" / "deploy.sh"

deploy_lock = threading.Lock()


class WebhookHandler(BaseHTTPRequestHandler):
    server_version = "WebhookServer/1.0"

    def log_message(self, format_str, *args):
        sys.stderr.write(f"[{self.log_date_time_string()}] {format_str % args}\n")

    def send_json(self, status_code: int, data: dict):
        response = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def do_GET(self):
        if self.path in ("/healthz", "/health"):
            self.send_json(200, {"status": "ok", "service": "deploy-webhook"})
            return
        self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        clean_path = self.path.split("?")[0].rstrip("/")
        if clean_path not in ("/deploy-webhook", "/hooks/deploy"):
            self.send_json(404, {"error": "Not found"})
            return

        # 1. Authenticate request
        if not SECRET:
            self.log_message("DEPLOY_WEBHOOK_SECRET environment variable is not configured!")
            self.send_json(500, {"error": "Server misconfigured: DEPLOY_WEBHOOK_SECRET is empty"})
            return

        token = self.headers.get("X-Deploy-Token")
        if not token:
            auth_header = self.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:].strip()

        if not token or not hmac.compare_digest(token, SECRET):
            self.log_message("Unauthorized webhook attempt rejected.")
            self.send_json(401, {"error": "Unauthorized"})
            return

        # 2. Prevent overlapping deployment runs
        if not deploy_lock.acquire(blocking=False):
            self.send_json(409, {"error": "Deployment already in progress"})
            return

        try:
            # 3. Parse optional body
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

            # Filter allowed services to avoid injection
            allowed = {"backend", "web"}
            sanitized_services = [s for s in services if s in allowed]
            if not sanitized_services:
                sanitized_services = ["backend", "web"]

            cmd = [str(DEPLOY_SCRIPT)] + sanitized_services
            self.log_message(f"Triggering deploy script: {' '.join(cmd)}")

            result = subprocess.run(
                cmd,
                cwd=str(BASE_DIR),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                check=False,
                timeout=600,  # 10 minute safety deadline
            )

            if result.returncode == 0:
                self.log_message("Deploy script succeeded.")
                self.send_json(200, {
                    "status": "success",
                    "services": sanitized_services,
                    "output": result.stdout[-2000:] if result.stdout else "",
                })
            else:
                self.log_message(f"Deploy script failed with code {result.returncode}.")
                self.send_json(500, {
                    "status": "error",
                    "returncode": result.returncode,
                    "services": sanitized_services,
                    "output": result.stdout[-4000:] if result.stdout else "",
                })

        except subprocess.TimeoutExpired:
            self.log_message("Deploy script timed out.")
            self.send_json(504, {"error": "Deployment script timed out after 10 minutes"})
        except Exception as exc:
            self.log_message(f"Unexpected error executing deploy: {exc}")
            self.send_json(500, {"error": str(exc)})
        finally:
            deploy_lock.release()


def run():
    if not SECRET:
        sys.stderr.write("WARNING: DEPLOY_WEBHOOK_SECRET environment variable is not set!\n")

    server_address = (HOST, PORT)
    httpd = HTTPServer(server_address, WebhookHandler)
    print(f"Webhook listener running on http://{HOST}:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()


if __name__ == "__main__":
    run()
