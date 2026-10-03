export interface ServerConfig {
  port: number;
  hostname: string;
  maxRequestBodySize: number;
  idleTimeout: number;
}

type EnvDict = Record<string, string | undefined>;

export const DEFAULT_PORT = 3000;
export const DEFAULT_HOSTNAME = "0.0.0.0";
export const DEFAULT_MAX_UPLOAD_MB = 1024;
export const BYTES_PER_MIB = 1024 * 1024;
/**
 * Extra headroom added on top of the configured upload limit so multipart
 * framing, fields, and boundaries never trip the request body cap.
 */
export const MULTIPART_OVERHEAD_BYTES = 20 * 1024 * 1024;
export const DEFAULT_IDLE_TIMEOUT = 0;

const MIN_PORT = 1;
const MAX_PORT = 65535;

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_PORT;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    return DEFAULT_PORT;
  }
  return port;
}

function parseMaxUploadMb(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_MAX_UPLOAD_MB;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_UPLOAD_MB;
  }
  return parsed;
}

/**
 * Pure parser for server network configuration. Accepts an environment
 * dictionary (defaulting to the process environment) and returns listen
 * options with predictable fallbacks. Never reads global state besides
 * the injected dictionary.
 */
export function loadServerConfig(env: EnvDict = process.env): ServerConfig {
  const maxUploadMb = parseMaxUploadMb(env.MAX_UPLOAD_SIZE_MB);
  return {
    port: parsePort(env.PORT),
    hostname: env.HOST ?? DEFAULT_HOSTNAME,
    maxRequestBodySize: maxUploadMb * BYTES_PER_MIB + MULTIPART_OVERHEAD_BYTES,
    idleTimeout: DEFAULT_IDLE_TIMEOUT,
  };
}
