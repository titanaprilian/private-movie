import { EventEmitter } from "node:events";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock("node:http", () => ({ request: requestMock }));
vi.mock("node:fs", () => ({ existsSync: () => true }));

import {
  MinioDockerUnavailableError,
  startMinioContainerViaDockerSocket,
} from "@/modules/storage";

const MINIO_IMAGE = "cgr.dev/chainguard/minio";
const MINIO_IMAGE_TAG = "latest";

interface CapturedCall {
  opts: { socketPath?: string; path: string; method: string };
  body?: string;
}

function respondWith(status: number) {
  requestMock.mockImplementationOnce(
    (opts: CapturedCall["opts"], cb: (res: EventEmitter & { statusCode: number; resume: () => void }) => void) => {
      const captured: CapturedCall = { opts };
      const res = Object.assign(new EventEmitter(), {
        statusCode: status,
        resume: () => {},
      });
      const req = Object.assign(new EventEmitter(), {
        end: () => {},
        destroy: () => {},
        setTimeout: () => req,
        write: (chunk: string) => {
          captured.body = (captured.body ?? "") + chunk;
        },
      });
      (requestMock as unknown as { __captured?: CapturedCall[] }).__captured ??= [];
      (requestMock as unknown as { __captured: CapturedCall[] }).__captured.push(captured);
      queueMicrotask(() => cb(res));
      return req;
    }
  );
}

function capturedCalls(): CapturedCall[] {
  return (requestMock as unknown as { __captured?: CapturedCall[] }).__captured ?? [];
}

describe("startMinioContainerViaDockerSocket", () => {
  beforeEach(() => {
    requestMock.mockReset();
    (requestMock as unknown as { __captured?: CapturedCall[] }).__captured = [];
  });

  it("resolves without pull/create when the container is already running", async () => {
    respondWith(204);
    await expect(startMinioContainerViaDockerSocket()).resolves.toBeUndefined();
    const calls = capturedCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].opts.path).toBe("/containers/private-movie-minio/start");
  });

  it("pulls the image, creates the container, and starts it when it does not exist", async () => {
    respondWith(404); // initial start → not found
    respondWith(200); // image pull
    respondWith(201); // container create
    respondWith(204); // start after create

    await expect(startMinioContainerViaDockerSocket()).resolves.toBeUndefined();

    const calls = capturedCalls();
    expect(calls).toHaveLength(4);
    expect(calls[0].opts).toMatchObject({
      method: "POST",
      path: "/containers/private-movie-minio/start",
    });
    expect(calls[1].opts).toMatchObject({
      method: "POST",
      path: `/images/create?fromImage=${encodeURIComponent(MINIO_IMAGE)}&tag=${encodeURIComponent(MINIO_IMAGE_TAG)}`,
    });
    expect(calls[2].opts).toMatchObject({
      method: "POST",
      path: "/containers/create?name=private-movie-minio",
    });

    const createBody = JSON.parse(calls[2].body ?? "{}") as Record<string, unknown>;
    expect(createBody.Image).toBe(`${MINIO_IMAGE}:${MINIO_IMAGE_TAG}`);
    expect(createBody.Cmd).toEqual(["server", "/data", "--console-address", ":9001"]);
    const hostConfig = createBody.HostConfig as Record<string, unknown>;
    expect(hostConfig.Binds).toEqual(["minio_data:/data"]);
    const portBindings = hostConfig.PortBindings as Record<string, { HostPort: string }[]>;
    expect(portBindings["9000/tcp"]).toEqual([{ HostPort: "9000" }]);
    expect(portBindings["9001/tcp"]).toEqual([{ HostPort: "9001" }]);

    expect(calls[3].opts).toMatchObject({
      method: "POST",
      path: "/containers/private-movie-minio/start",
    });
  });

  it("throws MinioDockerUnavailableError when image pull fails", async () => {
    respondWith(404); // initial start → not found
    respondWith(500); // image pull fails

    await expect(startMinioContainerViaDockerSocket()).rejects.toThrow(MinioDockerUnavailableError);
    expect(capturedCalls()).toHaveLength(2);
  });

  it("throws MinioDockerUnavailableError when container creation fails", async () => {
    respondWith(404);
    respondWith(200);
    respondWith(500); // create fails (e.g. name conflict)

    await expect(startMinioContainerViaDockerSocket()).rejects.toThrow(MinioDockerUnavailableError);
    expect(capturedCalls()).toHaveLength(3);
  });

  it("throws MinioDockerUnavailableError when the post-create start fails", async () => {
    respondWith(404);
    respondWith(200);
    respondWith(201);
    respondWith(500); // start still failing (e.g. port conflict)

    await expect(startMinioContainerViaDockerSocket()).rejects.toThrow(MinioDockerUnavailableError);
    expect(capturedCalls()).toHaveLength(4);
  });

  it("throws MinioDockerUnavailableError on non-404 start failures without provisioning", async () => {
    respondWith(500);
    await expect(startMinioContainerViaDockerSocket()).rejects.toThrow(MinioDockerUnavailableError);
    expect(capturedCalls()).toHaveLength(1);
  });
});
