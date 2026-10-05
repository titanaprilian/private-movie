export const SSE_PROGRESS_THROTTLE_MS = 250;

export interface SseProgressSample {
  loaded: number;
  total: number | null;
  percent: number | null;
}

export function createProgressThrottle(windowMs: number = SSE_PROGRESS_THROTTLE_MS) {
  let lastEmitTime = -Infinity;
  let lastPercent: number | null | undefined;

  return {
    shouldEmit(sample: SseProgressSample, now: number = Date.now()): boolean {
      if (lastEmitTime === -Infinity) return true;
      if (sample.percent !== lastPercent) return true;
      return now - lastEmitTime >= windowMs;
    },
    markEmitted(sample: SseProgressSample, now: number = Date.now()): void {
      lastEmitTime = now;
      lastPercent = sample.percent;
    },
  };
}

export type ProgressThrottle = ReturnType<typeof createProgressThrottle>;
