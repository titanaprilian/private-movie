export interface AppConfig {
  allowedOrigins: string[];
  apiDocsEnabled: boolean;
  isDevelopment: boolean;
}

type EnvDict = Record<string, string | undefined>;

const DEFAULT_PRODUCTION_ORIGIN = "http://localhost:5173";

function parseAllowedOrigins(env: EnvDict, isDevelopment: boolean): string[] {
  if (isDevelopment) {
    return [];
  }
  const raw = env.CORS_ORIGIN || DEFAULT_PRODUCTION_ORIGIN;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadAppConfig(env: EnvDict = process.env): AppConfig {
  const isDevelopment = env.NODE_ENV === "development";
  return {
    allowedOrigins: parseAllowedOrigins(env, isDevelopment),
    apiDocsEnabled:
      env.ENABLE_API_DOCS === "true" || env.NODE_ENV !== "production",
    isDevelopment,
  };
}

export function isApiDocsEnabled(env: EnvDict = process.env): boolean {
  return loadAppConfig(env).apiDocsEnabled;
}

export function isOriginAllowed(
  origin: string | null | undefined,
  config: AppConfig
): boolean {
  if (config.isDevelopment) {
    return origin !== null && origin !== undefined && origin !== "";
  }
  if (!origin || config.allowedOrigins.length === 0) {
    return false;
  }
  return config.allowedOrigins.includes(origin);
}
