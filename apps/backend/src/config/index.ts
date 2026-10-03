export { loadAppConfig, isApiDocsEnabled, isOriginAllowed } from "./app-config";
export type { AppConfig } from "./app-config";
export { loadServerConfig } from "./server-config";
export {
  DEFAULT_PORT,
  DEFAULT_HOSTNAME,
  DEFAULT_MAX_UPLOAD_MB,
  DEFAULT_IDLE_TIMEOUT,
  BYTES_PER_MIB,
  MULTIPART_OVERHEAD_BYTES,
  type ServerConfig,
} from "./server-config";
