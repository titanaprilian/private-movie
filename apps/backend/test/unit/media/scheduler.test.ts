import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createOngoingSeasonScheduler } from "../../../src/modules/media/scheduler";
import type { BatchOngoingScrapeResult } from "@repo/media-service";

describe("OngoingSeasonScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };

  const sampleBatchResult: BatchOngoingScrapeResult = {
    totalProcessed: 2,
    successCount: 2,
    failureCount: 0,
    results: [
      {
        seasonId: "season-1",
        seriesId: "series-1",
        success: true,
        tmdbSynced: true,
        episodesScraped: 12,
        sourcesSaved: 2,
        seasonCompleted: false,
      },
      {
        seasonId: "season-2",
        seriesId: "series-2",
        success: true,
        tmdbSynced: true,
        episodesScraped: 8,
        sourcesSaved: 1,
        seasonCompleted: true,
      },
    ],
  };

  it("runs periodically at configured interval (default 30 mins)", async () => {
    const scrapeAllOngoingSeasons = vi.fn().mockResolvedValue(sampleBatchResult);
    const mediaService = { scrapeAllOngoingSeasons };

    const scheduler = createOngoingSeasonScheduler({
      mediaService,
      intervalMs: 30 * 60 * 1000,
      logger: mockLogger,
    });

    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);
    expect(scrapeAllOngoingSeasons).not.toHaveBeenCalled();

    // Advance time by 30 minutes
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(scrapeAllOngoingSeasons).toHaveBeenCalledTimes(1);

    // Advance time by another 30 minutes
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(scrapeAllOngoingSeasons).toHaveBeenCalledTimes(2);

    await scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });

  it("runs immediately if runImmediately is set to true", async () => {
    const scrapeAllOngoingSeasons = vi.fn().mockResolvedValue(sampleBatchResult);
    const mediaService = { scrapeAllOngoingSeasons };

    const scheduler = createOngoingSeasonScheduler({
      mediaService,
      runImmediately: true,
      logger: mockLogger,
    });

    scheduler.start();
    // Allow immediate promise to resolve
    await vi.advanceTimersByTimeAsync(0);

    expect(scrapeAllOngoingSeasons).toHaveBeenCalledTimes(1);
    await scheduler.stop();
  });

  it("prevents overlapping runs with isJobRunning concurrency lock", async () => {
    let resolveFirstScrape: (value: BatchOngoingScrapeResult) => void;
    const slowScrapePromise = new Promise<BatchOngoingScrapeResult>((resolve) => {
      resolveFirstScrape = resolve;
    });

    const scrapeAllOngoingSeasons = vi
      .fn()
      .mockImplementationOnce(() => slowScrapePromise)
      .mockResolvedValue(sampleBatchResult);

    const mediaService = { scrapeAllOngoingSeasons };

    const scheduler = createOngoingSeasonScheduler({
      mediaService,
      intervalMs: 1000,
      logger: mockLogger,
    });

    scheduler.start();

    // Trigger first run
    await vi.advanceTimersByTimeAsync(1000);
    expect(scrapeAllOngoingSeasons).toHaveBeenCalledTimes(1);
    expect(scheduler.isExecuting()).toBe(true);

    // Try to trigger second run while first is still pending
    await vi.advanceTimersByTimeAsync(1000);
    // Should still have been called only once because first run is still executing
    expect(scrapeAllOngoingSeasons).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Previous scrape run is still active; skipping scheduled iteration.")
    );

    // Also test runNow() returns null when job is already running
    const runNowResult = await scheduler.runNow();
    expect(runNowResult).toBeNull();

    // Now complete the first scrape
    resolveFirstScrape!(sampleBatchResult);
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.isExecuting()).toBe(false);

    // Next timer tick should now run
    await vi.advanceTimersByTimeAsync(1000);
    expect(scrapeAllOngoingSeasons).toHaveBeenCalledTimes(2);

    await scheduler.stop();
  });

  it("handles errors gracefully without dying or stopping the scheduler loop", async () => {
    const scrapeAllOngoingSeasons = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network connection dropped"))
      .mockResolvedValueOnce(sampleBatchResult);

    const mediaService = { scrapeAllOngoingSeasons };

    const scheduler = createOngoingSeasonScheduler({
      mediaService,
      intervalMs: 1000,
      logger: mockLogger,
    });

    scheduler.start();

    // First run fails with error
    await vi.advanceTimersByTimeAsync(1000);
    expect(scrapeAllOngoingSeasons).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("Unexpected error during ongoing season scraping:"),
      expect.any(Error)
    );
    expect(scheduler.isRunning()).toBe(true);
    expect(scheduler.isExecuting()).toBe(false);

    // Second run succeeds
    await vi.advanceTimersByTimeAsync(1000);
    expect(scrapeAllOngoingSeasons).toHaveBeenCalledTimes(2);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Scrape run finished. Processed: 2, Success: 2, Failed: 0")
    );

    await scheduler.stop();
  });

  it("cleanly shuts down: clears timer and waits for active execution to wrap up", async () => {
    let resolveScrape: (value: BatchOngoingScrapeResult) => void;
    const pendingScrape = new Promise<BatchOngoingScrapeResult>((resolve) => {
      resolveScrape = resolve;
    });

    const scrapeAllOngoingSeasons = vi.fn().mockImplementation(() => pendingScrape);
    const mediaService = { scrapeAllOngoingSeasons };

    const scheduler = createOngoingSeasonScheduler({
      mediaService,
      intervalMs: 1000,
      logger: mockLogger,
    });

    scheduler.start();

    // Start job
    await vi.advanceTimersByTimeAsync(1000);
    expect(scheduler.isExecuting()).toBe(true);

    let stopResolved = false;
    const stopPromise = scheduler.stop().then(() => {
      stopResolved = true;
    });

    // Should not have resolved yet because job is still executing
    await vi.advanceTimersByTimeAsync(0);
    expect(stopResolved).toBe(false);
    expect(scheduler.isRunning()).toBe(false);

    // Complete the scrape job
    resolveScrape!(sampleBatchResult);
    await stopPromise;
    expect(stopResolved).toBe(true);
    expect(scheduler.isExecuting()).toBe(false);

    // Further timer ticks do nothing
    await vi.advanceTimersByTimeAsync(5000);
    expect(scrapeAllOngoingSeasons).toHaveBeenCalledTimes(1);
  });
});
