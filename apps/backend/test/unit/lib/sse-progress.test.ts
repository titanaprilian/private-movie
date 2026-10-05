import { describe, expect, it } from "vitest";
import {
  createProgressThrottle,
  SSE_PROGRESS_THROTTLE_MS,
} from "../../../src/lib/sse-progress";

describe("sse progress throttle", () => {
  it("emits first event and on whole-percent change", () => {
    const t = createProgressThrottle();
    expect(t.shouldEmit({ loaded: 1, total: 100, percent: 1 }, 0)).toBe(true);
    t.markEmitted({ loaded: 1, total: 100, percent: 1 }, 0);
    // same percent, no time elapsed -> suppressed
    expect(t.shouldEmit({ loaded: 1, total: 100, percent: 1 }, 10)).toBe(false);
    // whole percent change -> emit even within throttle window
    expect(t.shouldEmit({ loaded: 2, total: 100, percent: 2 }, 10)).toBe(true);
  });

  it("emits after throttle window even without percent change (unknown total)", () => {
    const t = createProgressThrottle();
    t.markEmitted({ loaded: 1, total: null, percent: null }, 0);
    expect(t.shouldEmit({ loaded: 2, total: null, percent: null }, 10)).toBe(false);
    expect(t.shouldEmit({ loaded: 2, total: null, percent: null }, SSE_PROGRESS_THROTTLE_MS + 1)).toBe(true);
  });

  it("suppresses rapid same-percent bursts", () => {
    const t = createProgressThrottle();
    let emitted = 0;
    let now = 0;
    for (let i = 0; i < 60; i++) {
      const p = { loaded: i, total: 100000, percent: 0 };
      if (t.shouldEmit(p, now)) { emitted += 1; t.markEmitted(p, now); }
      now += 5; // 5ms apart, same percent
    }
    expect(emitted).toBeLessThan(10);
  });
});
