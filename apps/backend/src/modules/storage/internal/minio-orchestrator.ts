import { existsSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { MINIO_CONTAINER_NAME, MINIO_SOCKET_PATH } from "./minio-status";

export class MinioDockerUnavailableError extends Error {
  constructor(
    message = "Docker daemon is not accessible. Ensure /var/run/docker.sock is mounted into the backend container."
  ) {
    super(message);
    this.name = "MinioDockerUnavailableError";
  }
}

export class MinioHealthTimeoutError extends Error {
  constructor(
    message = "MinIO container did not become healthy in time. Check container logs and port availability."
  ) {
    super(message);
    this.name = "MinioHealthTimeoutError";
  }
}

export class MinioCredentialsRejectedError extends Error {
  constructor(
    message = "MinIO rejected all known credential candidates. The server was initialized with different root credentials — set MINIO_ROOT_USER/MINIO_ROOT_PASSWORD to match, or reset the minio_data volume for a fresh start."
  ) {
    super(message);
    this.name = "MinioCredentialsRejectedError";
  }
}

const S3_AUTH_ERROR_NAMES = new Set([
  "SignatureDoesNotMatch",
  "InvalidAccessKeyId",
  "InvalidSignature",
  "InvalidClientTokenId",
  "MissingAuthenticationToken",
  "Forbidden",
  "AccessDenied",
  "Unauthorized",
  "InvalidSecurity",
]);

/**
 * Detect S3 authentication/authorization failures (wrong or unknown
 * credentials) as thrown by the AWS SDK v3 client. Used to decide whether
 * bucket provisioning is worth retrying with fallback credentials.
 */
export function isS3AuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (S3_AUTH_ERROR_NAMES.has(error.name)) return true;
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return status === 401 || status === 403;
}

export type MinioContainerStarter = (containerName?: string) => Promise<void>;
export type MinioHealthChecker = (endpoint: string) => Promise<void>;

export const MINIO_IMAGE = "cgr.dev/chainguard/minio";
export const MINIO_IMAGE_TAG = "latest";
export const MINIO_DATA_VOLUME = "minio_data";
export const MINIO_API_PORT = 9000;
export const MINIO_CONSOLE_PORT = 9001;

interface DockerRequestOptions {
  method: string;
  path: string;
  body?: unknown;
  timeoutMs?: number;
}

function dockerRequest(options: DockerRequestOptions): Promise<number> {
  return new Promise((resolve, reject) => {
    const payload = options.body !== undefined ? JSON.stringify(options.body) : undefined;
    const req = httpRequest(
      {
        socketPath: MINIO_SOCKET_PATH,
        path: options.path,
        method: options.method,
        ...(payload !== undefined
          ? { headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } }
          : {}),
      },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      }
    );
    req.on("error", () => reject(new MinioDockerUnavailableError()));
    req.setTimeout(options.timeoutMs ?? 10_000, () => {
      req.destroy();
      reject(new MinioDockerUnavailableError("Timed out contacting the Docker daemon."));
    });
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

/**
 * Pull the MinIO image via the Docker Engine API. Tolerates the image
 * already being present (Docker returns 200 with progress stream either way).
 */
async function ensureMinioImage(): Promise<void> {
  const status = await dockerRequest({
    method: "POST",
    path: `/images/create?fromImage=${encodeURIComponent(MINIO_IMAGE)}&tag=${encodeURIComponent(MINIO_IMAGE_TAG)}`,
    timeoutMs: 120_000,
  });
  if (status !== 200 && status !== 201 && status !== 204) {
    throw new MinioDockerUnavailableError(
      `Failed to pull MinIO image "${MINIO_IMAGE}:${MINIO_IMAGE_TAG}": Docker daemon returned status ${status}.`
    );
  }
}

/**
 * Create the MinIO container via the Docker Engine API, mirroring the
 * compose service: persistent `minio_data:/data` volume, host port bindings
 * for the S3 API (9000) and console (9001), and `server /data
 * --console-address :9001`.
 */
async function createMinioContainer(containerName: string): Promise<void> {
  const env: string[] = [
    `MINIO_API_CORS_ALLOW_ORIGINS=${process.env.MINIO_API_CORS_ALLOW_ORIGINS?.trim() || "*"}`,
  ];
  const rootUser = process.env.MINIO_ROOT_USER?.trim();
  const rootPassword = process.env.MINIO_ROOT_PASSWORD?.trim();
  if (rootUser) env.push(`MINIO_ROOT_USER=${rootUser}`);
  if (rootPassword) env.push(`MINIO_ROOT_PASSWORD=${rootPassword}`);

  const status = await dockerRequest({
    method: "POST",
    path: `/containers/create?name=${encodeURIComponent(containerName)}`,
    body: {
      Image: `${MINIO_IMAGE}:${MINIO_IMAGE_TAG}`,
      Cmd: ["server", "/data", "--console-address", `:${MINIO_CONSOLE_PORT}`],
      ...(env.length > 0 ? { Env: env } : {}),
      ExposedPorts: {
        [`${MINIO_API_PORT}/tcp`]: {},
        [`${MINIO_CONSOLE_PORT}/tcp`]: {},
      },
      HostConfig: {
        Binds: [`${MINIO_DATA_VOLUME}:/data`],
        PortBindings: {
          [`${MINIO_API_PORT}/tcp`]: [{ HostPort: String(MINIO_API_PORT) }],
          [`${MINIO_CONSOLE_PORT}/tcp`]: [{ HostPort: String(MINIO_CONSOLE_PORT) }],
        },
        RestartPolicy: { Name: "unless-stopped" },
      },
    },
  });
  if (status !== 201 && status !== 204) {
    throw new MinioDockerUnavailableError(
      `Failed to create MinIO container "${containerName}": Docker daemon returned status ${status}. Check for port conflicts on 9000/9001.`
    );
  }
}

async function startExistingMinioContainer(containerName: string): Promise<number> {
  return dockerRequest({
    method: "POST",
    path: `/containers/${containerName}/start`,
  });
}

/**
 * Start the MinIO container via the Docker Engine API over the unix socket.
 * Resolves without error when the container is already running (304/200).
 * When the container does not exist yet (404), the image is pulled if needed,
 * the container is created (persistent volume, port bindings, server command)
 * and then started — a true zero-CLI, 1-click provisioning experience.
 * Throws MinioDockerUnavailableError when the socket is missing or Docker
 * reports an unrecoverable failure.
 */
export function startMinioContainerViaDockerSocket(
  containerName: string = MINIO_CONTAINER_NAME
): Promise<void> {
  if (!existsSync(MINIO_SOCKET_PATH)) {
    return Promise.reject(new MinioDockerUnavailableError());
  }
  return (async () => {
    const status = await startExistingMinioContainer(containerName);
    if (status === 204 || status === 304) return;
    if (status === 404) {
      // Container was never created — provision it from scratch, then start.
      await ensureMinioImage();
      await createMinioContainer(containerName);
      const retryStatus = await startExistingMinioContainer(containerName);
      if (retryStatus === 204 || retryStatus === 304) return;
      throw new MinioDockerUnavailableError(
        `Failed to start newly created MinIO container "${containerName}": Docker daemon returned status ${retryStatus}. Check for port conflicts on 9000/9001.`
      );
    }
    throw new MinioDockerUnavailableError(
      `Failed to start MinIO container "${containerName}": Docker daemon returned status ${status}. Check for port conflicts on 9000/9001.`
    );
  })();
}

/**
 * Poll the MinIO liveness endpoint until it returns HTTP 200.
 * Throws MinioHealthTimeoutError after `timeoutMs`.
 */
export async function waitForMinioHealthy(
  endpoint: string,
  options?: { timeoutMs?: number; intervalMs?: number; fetchFn?: typeof fetch }
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 60_000;
  const intervalMs = options?.intervalMs ?? 1000;
  const fetchFn = options?.fetchFn ?? fetch;
  const healthUrl = `${endpoint.replace(/\/+$/, "")}/minio/health/live`;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      const res = await fetchFn(healthUrl);
      if (res.ok) return;
      lastError = new Error(`MinIO health check returned status ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new MinioHealthTimeoutError(
    `MinIO at ${endpoint} did not become healthy within ${Math.round(timeoutMs / 1000)}s. ` +
      `Check container logs and port availability. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

/**
 * Default root credentials MinIO uses when `MINIO_ROOT_USER` /
 * `MINIO_ROOT_PASSWORD` are unset (the out-of-the-box compose setup).
 */
export const MINIO_DEFAULT_ROOT_USER = "minioadmin";
export const MINIO_DEFAULT_ROOT_PASSWORD = "minioadmin";

/**
 * Resolve the MinIO root access key, preferring the credentials the
 * container was initialized with so bucket provisioning authenticates
 * out of the box. Falls back to MinIO's own default root user.
 */
export function resolveMinioAccessKey(explicit?: string): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  return (
    process.env.MINIO_ROOT_USER?.trim() ||
    process.env.MINIO_ACCESS_KEY?.trim() ||
    MINIO_DEFAULT_ROOT_USER
  );
}

/**
 * Resolve the MinIO root secret key, preferring the container's configured
 * password. Falls back to MinIO's own default root password.
 */
export function resolveMinioSecretKey(explicit?: string): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  return (
    process.env.MINIO_ROOT_PASSWORD?.trim() ||
    process.env.MINIO_SECRET_KEY?.trim() ||
    MINIO_DEFAULT_ROOT_PASSWORD
  );
}

export function resolveMinioEndpoint(input?: {
  endpoint?: string;
  port?: number;
}): string {
  const explicit = input?.endpoint?.trim();
  if (explicit) {
    if (explicit.startsWith("http://") || explicit.startsWith("https://")) return explicit;
    return `http://${explicit}`;
  }
  const port = input?.port ?? Number(process.env.MINIO_PORT ?? 9000);
  return `http://localhost:${port}`;
}

export function resolveMinioConsoleUrlFromInput(input?: {
  endpoint?: string;
  consolePort?: number;
}): string {
  const explicit = process.env.MINIO_CONSOLE_URL;
  if (explicit && explicit.trim()) return explicit.trim();
  const consolePort = input?.consolePort ?? Number(process.env.MINIO_CONSOLE_PORT ?? 9001);
  const endpoint = resolveMinioEndpoint(input);
  try {
    const parsed = new URL(endpoint);
    parsed.port = String(consolePort);
    parsed.pathname = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return `http://localhost:${consolePort}`;
  }
}
