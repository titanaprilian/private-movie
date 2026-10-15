import type { BatchOngoingScrapeResult, MediaService } from "@repo/media-service";
import type { DbClient } from "@repo/db";

export interface SchedulerLogger {
  info(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
}

export interface SchedulerConfig {
  intervalMinutes: number;
  isEnabled: boolean;
}

export type SchedulerConfigDb = Pick<DbClient, "select" | "insert"> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export interface OngoingSeasonSchedulerOptions {
  mediaService: Pick<MediaService, "scrapeAllOngoingSeasons">;
  intervalMs?: number;
  runImmediately?: boolean;
  enabled?: boolean;
  logger?: SchedulerLogger;
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

export interface StartOngoingSeasonSchedulerOptions {
  db: SchedulerConfigDb;
  mediaService: Pick<MediaService, "scrapeAllOngoingSeasons">;
  runImmediately?: boolean;
  logger?: SchedulerLogger;
}

export interface CryptoSubtleRequestPayload {
  op: string;
  algorithm: Record<string, unknown>;
  keyRaw?: string;
  keyAlgorithm?: Record<string, unknown>;
  data: string;
  signature?: string;
}

export type SourceCheckType = "direct" | "embed" | "s3";

export interface SourceProbeResult {
  status: "working" | "broken";
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
}
