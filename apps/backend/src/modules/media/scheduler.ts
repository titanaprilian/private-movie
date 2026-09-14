import type { BatchOngoingScrapeResult, MediaService } from "@repo/media-service";

export interface OngoingSeasonSchedulerOptions {
  mediaService: Pick<MediaService, "scrapeAllOngoingSeasons">;
  intervalMs?: number;
  runImmediately?: boolean;
  logger?: {
    info(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
  };
}

export interface OngoingSeasonScheduler {
  start(): void;
  stop(): Promise<void>;
  runNow(): Promise<BatchOngoingScrapeResult | null>;
  isRunning(): boolean;
  isExecuting(): boolean;
}

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function createOngoingSeasonScheduler(
  options: OngoingSeasonSchedulerOptions
): OngoingSeasonScheduler {
  const {
    mediaService,
    intervalMs = DEFAULT_INTERVAL_MS,
    runImmediately = false,
    logger = console,
  } = options;

  let timer: ReturnType<typeof setInterval> | null = null;
  let isExecutingJob = false;
  let currentExecutionPromise: Promise<BatchOngoingScrapeResult | null> | null = null;
  let isStarted = false;

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
      try {
        const batchResult = await mediaService.scrapeAllOngoingSeasons();
        logger.info(
          `[OngoingSeasonScheduler] Scrape run finished. Processed: ${batchResult.totalProcessed}, ` +
            `Success: ${batchResult.successCount}, Failed: ${batchResult.failureCount}`
        );
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
        `[OngoingSeasonScheduler] Initialized with interval ${intervalMs}ms.`
      );

      if (runImmediately) {
        void executeJob();
      }

      timer = setInterval(() => {
        void executeJob();
      }, intervalMs);

      // Unref timer if running in Node runtime so it doesn't prevent graceful exit on its own
      if (timer && typeof timer === "object" && "unref" in timer) {
        timer.unref();
      }
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
  };
}
