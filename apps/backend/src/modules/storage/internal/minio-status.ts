import { existsSync } from "node:fs";
import { request as httpRequest } from "node:http";
import type { MinioStatusResponseData } from "@repo/contracts";

export const MINIO_CONTAINER_NAME = "private-movie-minio";
export const MINIO_SOCKET_PATH = "/var/run/docker.sock";

export interface MinioContainerState {
  isAvailable: boolean;
  isRunning: boolean;
}

export type MinioContainerInspector = (
  containerName?: string
) => Promise<MinioContainerState>;

function inspectViaDockerSocket(containerName: string): Promise<MinioContainerState> {
  return new Promise((resolve) => {
    if (!existsSync(MINIO_SOCKET_PATH)) {
      resolve({ isAvailable: false, isRunning: false });
      return;
    }
    const req = httpRequest(
      {
        socketPath: MINIO_SOCKET_PATH,
        path: `/containers/${containerName}/json`,
        method: "GET",
      },
      (res) => {
        if (res.statusCode === 404) {
          res.resume();
          resolve({ isAvailable: true, isRunning: false });
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          resolve({ isAvailable: false, isRunning: false });
          return;
        }
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          try {
            const json = JSON.parse(raw) as { State?: { Running?: boolean } };
            resolve({ isAvailable: true, isRunning: json.State?.Running === true });
          } catch {
            resolve({ isAvailable: true, isRunning: false });
          }
        });
      }
    );
    req.on("error", () => resolve({ isAvailable: false, isRunning: false }));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve({ isAvailable: false, isRunning: false });
    });
    req.end();
  });
}

export function createDefaultMinioInspector(): MinioContainerInspector {
  return (containerName = MINIO_CONTAINER_NAME) =>
    inspectViaDockerSocket(containerName);
}

export function resolveMinioConsoleUrl(): string {
  const explicit = process.env.MINIO_CONSOLE_URL;
  if (explicit && explicit.trim()) return explicit.trim();
  const port = process.env.MINIO_CONSOLE_PORT ?? "9001";
  return `http://localhost:${port}`;
}

export function buildMinioStatusResponse(
  container: MinioContainerState,
  provider: { id: string; endpoint: string; bucket: string } | null
): MinioStatusResponseData {
  const isConfigured = provider !== null;
  return {
    isAvailable: container.isAvailable,
    isRunning: container.isRunning,
    isConfigured,
    consoleUrl: resolveMinioConsoleUrl(),
    ...(isConfigured && provider
      ? { providerId: provider.id, endpoint: provider.endpoint, bucket: provider.bucket }
      : {}),
  };
}
