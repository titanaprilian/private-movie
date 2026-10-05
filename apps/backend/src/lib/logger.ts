import pino, { type LoggerOptions, type Logger as PinoLogger } from "pino";

export type AppLogger = Pick<PinoLogger, "info" | "warn" | "error" | "debug" | "child">;

export interface CreateLoggerOptions {
  level?: string;
  isDevelopment?: boolean;
  destination?: NodeJS.WritableStream;
}

function resolveLevel(env: NodeJS.ProcessEnv, explicit?: string): string {
  if (explicit) return explicit;
  const fromEnv = env.LOG_LEVEL;
  if (fromEnv) return fromEnv;
  return env.NODE_ENV === "development" ? "debug" : "info";
}

export function createLogger(options: CreateLoggerOptions = {}): AppLogger {
  const env = process.env;
  const isDevelopment = options.isDevelopment ?? env.NODE_ENV === "development";
  const level = resolveLevel(env, options.level);

  const pinoOptions: LoggerOptions = { level };
  if (isDevelopment) {
    pinoOptions.transport = {
      target: "pino-pretty",
      options: { colorize: true, singleLine: true },
    };
  }
  if (options.destination && !pinoOptions.transport) {
    return pino(pinoOptions, options.destination);
  }
  return pino(pinoOptions);
}

export const logger: AppLogger = createLogger();
