import { describe, it, expect, vi, afterEach } from "vitest";
import {
  startOngoingSeasonScheduler,
  loadSchedulerConfig,
  saveSchedulerConfig,
  validateSchedulerConfigInput,
  ALLOWED_SCHEDULER_INTERVALS,
  DEFAULT_SCHEDULER_INTERVAL_MINUTES,
  DEFAULT_SCHEDULER_ENABLED,
} from "../../../src/modules/media";

describe("media module scheduler config exports", () => {
  it("exports persistence handlers and validation constants", () => {
    expect(typeof loadSchedulerConfig).toBe("function");
    expect(typeof saveSchedulerConfig).toBe("function");
    expect(typeof validateSchedulerConfigInput).toBe("function");
    expect([...ALLOWED_SCHEDULER_INTERVALS]).toEqual([15, 30, 60, 180, 360, 720, 1440]);
    expect(DEFAULT_SCHEDULER_INTERVAL_MINUTES).toBe(30);
    expect(DEFAULT_SCHEDULER_ENABLED).toBe(true);
  });

  it("loads default config when no persisted values exist", async () => {
    const db = {
      select: vi.fn(() => ({
        from: () => ({ where: async () => [] }),
      })),
    } as never;
    await expect(loadSchedulerConfig(db)).resolves.toEqual({
      intervalMinutes: 30,
      isEnabled: true,
    });
  });
});

describe("startOngoingSeasonScheduler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function fakeDb(intervalValue: string | null, enabledValue: string | null) {
    const select = vi.fn();
    select.mockImplementationOnce(() => ({
      from: () => ({
        where: async () =>
          intervalValue === null ? [] : [{ value: intervalValue }],
      }),
    }));
    select.mockImplementationOnce(() => ({
      from: () => ({
        where: async () =>
          enabledValue === null ? [] : [{ value: enabledValue }],
      }),
    }));
    return { select } as never;
  }

  function fakeMediaService() {
    return {
      scrapeAllOngoingSeasons: vi.fn().mockResolvedValue({
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
      }),
    };
  }

  it("loads defaults, converts minutes to milliseconds, starts, and returns the handle", async () => {
    const mediaService = fakeMediaService();
    const scheduler = await startOngoingSeasonScheduler({
      db: fakeDb(null, null),
      mediaService,
      runImmediately: false,
    });

    expect(scheduler.getIntervalMs()).toBe(30 * 60 * 1000);
    expect(scheduler.isEnabled()).toBe(true);
    expect(scheduler.isRunning()).toBe(true);
    expect(mediaService.scrapeAllOngoingSeasons).not.toHaveBeenCalled();
    await scheduler.stop();
  });

  it("applies persisted interval and disabled flag", async () => {
    const mediaService = fakeMediaService();
    const scheduler = await startOngoingSeasonScheduler({
      db: fakeDb("60", "false"),
      mediaService,
    });

    expect(scheduler.getIntervalMs()).toBe(60 * 60 * 1000);
    expect(scheduler.isEnabled()).toBe(false);
    expect(scheduler.isRunning()).toBe(true);
    // Disabled schedulers never run, even with runImmediately defaulting to true.
    await new Promise((resolve) => setImmediate(resolve));
    expect(mediaService.scrapeAllOngoingSeasons).not.toHaveBeenCalled();
    await scheduler.stop();
  });

  it("runs immediately by default when enabled", async () => {
    const mediaService = fakeMediaService();
    const scheduler = await startOngoingSeasonScheduler({
      db: fakeDb(null, null),
      mediaService,
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(mediaService.scrapeAllOngoingSeasons).toHaveBeenCalledOnce();
    await scheduler.stop();
  });
});
