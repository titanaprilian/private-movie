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

export const SSE_HEARTBEAT_MS = 15_000;

export const SSE_HEARTBEAT_COMMENT = ": ping\n\n";

export function shouldSendHeartbeat(lastActivityMs: number, nowMs: number, intervalMs: number = SSE_HEARTBEAT_MS): boolean {
  return nowMs - lastActivityMs >= intervalMs;
}

export type ProgressThrottle = ReturnType<typeof createProgressThrottle>;
