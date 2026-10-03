import type { BatchOngoingScrapeResult, MediaService } from "@repo/media-service";
import {
  loadSchedulerConfig,
  type SchedulerConfigDb,
} from "./scheduler-config";

export interface OngoingSeasonSchedulerOptions {
  mediaService: Pick<MediaService, "scrapeAllOngoingSeasons">;
  intervalMs?: number;
  runImmediately?: boolean;
  enabled?: boolean;
  logger?: {
    info(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
  };
}

export interface SchedulerLastRunResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

export interface OngoingSeasonScheduler {
  start(): void;
  stop(): Promise<void>;
  runNow(): Promise<BatchOngoingScrapeResult | null>;
  isRunning(): boolean;
  isExecuting(): boolean;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  getIntervalMs(): number;
  updateInterval(intervalMs: number): void;
  getLastRunAt(): Date | null;
  getLastRunResult(): SchedulerLastRunResult | null;
  getNextRunAt(): Date | null;
}

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

const MS_PER_MINUTE = 60 * 1000;

export const SCHEDULER_DEFAULT_INTERVAL_MINUTES = 30;
export const SCHEDULER_DEFAULT_ENABLED = true;

export interface StartOngoingSeasonSchedulerOptions {
  db: SchedulerConfigDb;
  mediaService: Pick<MediaService, "scrapeAllOngoingSeasons">;
  runImmediately?: boolean;
  logger?: OngoingSeasonSchedulerOptions["logger"];
}

/**
 * Encapsulated scheduler startup for the server entry point: loads persisted
 * scheduler configuration (falling back to defaults), converts interval
 * minutes to milliseconds, and returns the running scheduler handle.
 */
export async function startOngoingSeasonScheduler(
  options: StartOngoingSeasonSchedulerOptions
): Promise<OngoingSeasonScheduler> {
  const { db, mediaService, runImmediately = true, logger } = options;
  const config = await loadSchedulerConfig(db);
  const scheduler = createOngoingSeasonScheduler({
    mediaService,
    intervalMs: config.intervalMinutes * MS_PER_MINUTE,
    enabled: config.isEnabled,
    runImmediately,
    logger,
  });
  scheduler.start();
  return scheduler;
}

export function createOngoingSeasonScheduler(
  options: OngoingSeasonSchedulerOptions
): OngoingSeasonScheduler {
  const {
    mediaService,
    intervalMs = DEFAULT_INTERVAL_MS,
    runImmediately = false,
    enabled = true,
    logger = console,
  } = options;

  let timer: ReturnType<typeof setInterval> | null = null;
  let isExecutingJob = false;
  let currentExecutionPromise: Promise<BatchOngoingScrapeResult | null> | null = null;
  let isStarted = false;
  let isSchedulerEnabled = enabled;
  let currentIntervalMs = intervalMs;
  let lastRunAt: Date | null = null;
  let lastRunResult: SchedulerLastRunResult | null = null;
  let nextRunAt: Date | null = null;

  function scheduleTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    nextRunAt = isStarted && isSchedulerEnabled ? new Date(Date.now() + currentIntervalMs) : null;
    if (!isStarted || !isSchedulerEnabled) {
      return;
    }
    timer = setInterval(() => {
      if (!isSchedulerEnabled) {
        return;
      }
      nextRunAt = new Date(Date.now() + currentIntervalMs);
      void executeJob();
    }, currentIntervalMs);

    // Unref timer if running in Node runtime so it doesn't prevent graceful exit on its own
    if (timer && typeof timer === "object" && "unref" in timer) {
      (timer as unknown as { unref(): void }).unref();
    }
  }

  async function executeJob(): Promise<BatchOngoingScrapeResult | null> {
    if (isExecutingJob) {
      logger.warn(
        "[OngoingSeasonScheduler] Previous scrape run is still active; skipping scheduled iteration."
      );
      return null;
    }

    isExecutingJob = true;
    const runPromise = (async () => {
      logger.info("[OngoingSeasonScheduler] Starting ongoing season scrape run...");
      lastRunAt = new Date();
      try {
        const batchResult = await mediaService.scrapeAllOngoingSeasons();
        logger.info(
          `[OngoingSeasonScheduler] Scrape run finished. Processed: ${batchResult.totalProcessed}, ` +
            `Success: ${batchResult.successCount}, Failed: ${batchResult.failureCount}`
        );
        lastRunResult = {
          totalProcessed: batchResult.totalProcessed,
          successCount: batchResult.successCount,
          failureCount: batchResult.failureCount,
        };
        return batchResult;
      } catch (error) {
        logger.error(
          "[OngoingSeasonScheduler] Unexpected error during ongoing season scraping:",
          error
        );
        return null;
      } finally {
        isExecutingJob = false;
        currentExecutionPromise = null;
      }
    })();

    currentExecutionPromise = runPromise;
    return runPromise;
  }

  return {
    start() {
      if (isStarted) {
        return;
      }
      isStarted = true;
      logger.info(
        `[OngoingSeasonScheduler] Initialized with interval ${currentIntervalMs}ms.`
      );

      if (runImmediately && isSchedulerEnabled) {
        nextRunAt = new Date(Date.now() + currentIntervalMs);
        void executeJob();
      }

      scheduleTimer();
    },

    async stop() {
      if (!isStarted && !timer && !currentExecutionPromise) {
        return;
      }
      isStarted = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      logger.info(
        "[OngoingSeasonScheduler] Scheduler stopped. Waiting for active run to wrap up..."
      );
      if (currentExecutionPromise) {
        await currentExecutionPromise;
      }
      logger.info("[OngoingSeasonScheduler] Shutdown complete.");
    },

    async runNow() {
      return executeJob();
    },

    isRunning() {
      return isStarted;
    },

    isExecuting() {
      return isExecutingJob;
    },

    isEnabled() {
      return isSchedulerEnabled;
    },

    setEnabled(enabledValue: boolean) {
      isSchedulerEnabled = enabledValue;
      scheduleTimer();
    },

    getIntervalMs() {
      return currentIntervalMs;
    },

    updateInterval(nextIntervalMs: number) {
      currentIntervalMs = nextIntervalMs;
      scheduleTimer();
    },

    getLastRunAt() {
      return lastRunAt;
    },

    getLastRunResult() {
      return lastRunResult;
    },

    getNextRunAt() {
      return nextRunAt;
    },
  };
}
