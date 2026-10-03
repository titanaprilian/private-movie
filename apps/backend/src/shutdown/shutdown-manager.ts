/**
 * A single named cleanup phase executed during graceful shutdown
 * (e.g. draining the HTTP listener, stopping schedulers, closing browsers).
 */
export interface ShutdownStep {
  name: string;
  run: () => void | Promise<void>;
}

/** Minimal process surface the manager needs. Inject a fake in tests. */
export interface ShutdownProcess {
  on(event: "SIGINT" | "SIGTERM", handler: () => void): void;
  exit(code: number): void;
}

/** Timer surface. Inject manual fakes in tests to control the timeout. */
export interface ShutdownTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

export interface ShutdownLogger {
  error(...args: unknown[]): void;
}

export interface ShutdownManagerOptions {
  steps?: ShutdownStep[];
  /** Guaranteed kill timeout. Defaults to 10 seconds. */
  timeoutMs?: number;
  proc?: ShutdownProcess;
  timers?: ShutdownTimers;
  logger?: ShutdownLogger;
}

export interface ShutdownManager {
  /** Runs all steps sequentially, then exits the process. Idempotent. */
  shutdown(): Promise<void>;
  /** Binds SIGINT and SIGTERM to the single shutdown execution path. */
  registerShutdownHandlers(): void;
  /** Appends a step to the end of the shutdown sequence. */
  addStep(step: ShutdownStep): void;
}

/** Guarantees the process terminates with code 1 if cleanup hangs. */
export const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Sequential graceful shutdown manager with step error isolation,
 * duplicate-signal protection, and timeout enforcement.
 */
export function createShutdownManager(
  options: ShutdownManagerOptions = {}
): ShutdownManager {
  const steps: ShutdownStep[] = [...(options.steps ?? [])];
  const timeoutMs = options.timeoutMs ?? SHUTDOWN_TIMEOUT_MS;
  const proc: ShutdownProcess =
    options.proc ?? (process as unknown as ShutdownProcess);
  const timers: ShutdownTimers = options.timers ?? {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  };
  const logger: ShutdownLogger = options.logger ?? console;

  let shuttingDown = false;
  let settled = false;

  const finish = (timerId: unknown, code: number): void => {
    if (settled) {
      return;
    }
    settled = true;
    timers.clearTimeout(timerId);
    proc.exit(code);
  };

  const shutdown = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    const timerId = timers.setTimeout(() => {
      finish(timerId, 1);
    }, timeoutMs);

    let hadError = false;
    for (const step of steps) {
      try {
        await step.run();
      } catch (error) {
        hadError = true;
        logger.error(`[Shutdown] step "${step.name}" failed`, error);
      }
    }
    finish(timerId, hadError ? 1 : 0);
  };

  const registerShutdownHandlers = (): void => {
    proc.on("SIGINT", () => {
      void shutdown();
    });
    proc.on("SIGTERM", () => {
      void shutdown();
    });
  };

  const addStep = (step: ShutdownStep): void => {
    steps.push(step);
  };

  return { shutdown, registerShutdownHandlers, addStep };
}
