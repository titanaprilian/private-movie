export const GB_IN_BYTES = 1024 * 1024 * 1024;

export function formatGb(bytes: number): string {
  return `${(bytes / GB_IN_BYTES).toFixed(1)} GB`;
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return 'recently';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatCountdown(targetIso: string | null): string {
  if (!targetIso) return 'Not scheduled';
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (Number.isNaN(diffMs)) return 'Not scheduled';
  if (diffMs <= 0) return 'Due now';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'in under a minute';
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rem = minutes % 60;
    return rem === 0 ? `in ${hours}h` : `in ${hours}h ${rem}m`;
  }
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

/** Minutes until the target ISO time, rounded down. Null when unscheduled/invalid. */
export function formatCountdownMinutes(targetIso: string | null): number | null {
  if (!targetIso) return null;
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (Number.isNaN(diffMs) || diffMs <= 0) return null;
  return Math.round(diffMs / 60000);
}

export function schedulerStatusLabel(scheduler: {
  isEnabled: boolean;
  isExecuting: boolean;
}): string {
  if (scheduler.isExecuting) return 'Scraping';
  return scheduler.isEnabled ? 'Active' : 'Idle';
}

export interface StorageStatsLike {
  totalUsedBytes: number;
  totalLimitBytes: number;
  percentUsed: number;
}

/** Storage is only "tracked" when usage is a positive finite number. */
export function isStorageTracked(storage: StorageStatsLike | null | undefined): boolean {
  if (!storage) return false;
  return (
    Number.isFinite(storage.totalUsedBytes) &&
    storage.totalUsedBytes > 0 &&
    Number.isFinite(storage.totalLimitBytes) &&
    storage.totalLimitBytes > 0
  );
}

/** Display text for the storage stat card: "Not tracked" fallback or "{used} GB". */
export function formatStorageValue(storage: StorageStatsLike | null | undefined): string {
  if (!storage) return 'Not tracked';
  if (!isStorageTracked(storage)) return 'Not tracked';
  return formatGb(storage.totalUsedBytes);
}

/**
 * Unified scheduler status line for the SchedulerPanel left side:
 * "Auto-scraper is on · next run in {x} min" or "Auto-scraper is off".
 */
export function formatSchedulerStatusText(scheduler: {
  isEnabled: boolean;
  isExecuting: boolean;
  nextRunAt: string | null;
}): string {
  if (!scheduler.isEnabled) return 'Auto-scraper is off';
  if (scheduler.isExecuting) return 'Auto-scraper is on · scraping now';
  const minutes = formatCountdownMinutes(scheduler.nextRunAt);
  if (minutes === null) return 'Auto-scraper is on · next run not scheduled';
  if (minutes < 1) return 'Auto-scraper is on · next run in under a minute';
  if (minutes < 60) return `Auto-scraper is on · next run in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rem = minutes % 60;
    return rem === 0
      ? `Auto-scraper is on · next run in ${hours} h`
      : `Auto-scraper is on · next run in ${hours} h ${rem} min`;
  }
  return `Auto-scraper is on · next run in ${Math.floor(hours / 24)} d`;
}

/** Series card footer: "{ongoing} ongoing · {featured} featured". */
export function formatSeriesFooter(ongoing: number, featured: number): string {
  return `${ongoing} ongoing · ${featured} featured`;
}

export interface OngoingSeasonLike {
  seasonId: string;
  seasonNumber: number | null;
  episodeCount: number;
  lastScrapeError: string | null;
}

/** Failed-first sort: seasons with a scrape error come first, stable otherwise. */
export function sortOngoingFailedFirst<T extends OngoingSeasonLike>(seasons: T[]): T[] {
  return [...seasons].sort((a, b) => {
    const aFailed = a.lastScrapeError ? 1 : 0;
    const bFailed = b.lastScrapeError ? 1 : 0;
    return bFailed - aFailed;
  });
}

/** Meta line: "Season X · N eps" (falls back to just "N eps" when unknown). */
export function formatSeasonMeta(seasonNumber: number | null, episodeCount: number): string {
  const eps = `${episodeCount} eps`;
  if (seasonNumber === null || seasonNumber === undefined || Number.isNaN(seasonNumber)) {
    return eps;
  }
  return `Season ${seasonNumber} · ${eps}`;
}

export interface ParsedScrapeError {
  /** Human-readable message shown prominently on the card. */
  friendly: string;
  /** Shortened raw error/ID snippet shown below the friendly message. */
  snippet: string;
}

const SEASON_NOT_FOUND_RE = /season\s+([A-Za-z0-9_-]{1,64})\s+not\s+found/i;

/** Truncate a raw error string to a readable snippet (default 160 chars). */
export function truncateErrorMessage(raw: string, maxLength = 160): string {
  const trimmed = raw.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Parse a raw scrape error into a friendly message plus a raw snippet.
 * "Season <id> not found" style errors map to "Season not found on the source site".
 */
export function parseScrapeError(raw: string | null | undefined): ParsedScrapeError {
  if (!raw || !raw.trim()) {
    return { friendly: 'Scrape failed', snippet: '' };
  }
  const trimmed = raw.trim();
  const match = SEASON_NOT_FOUND_RE.exec(trimmed);
  if (match) {
    return {
      friendly: 'Season not found on the source site',
      snippet: truncateErrorMessage(`ID: ${match[1]} · ${trimmed}`),
    };
  }
  return { friendly: truncateErrorMessage(trimmed, 140), snippet: truncateErrorMessage(trimmed) };
}

export type ActivityEventKind = 'failed' | 'updated';

export interface ActivityEvent {
  kind: ActivityEventKind;
  key: string;
  title: string;
  detail: string;
  timeIso: string | null;
  seriesId: string;
  seasonId?: string;
}

export interface RecentSeriesLike {
  id: string;
  title: string;
  episodeCount: number;
  updatedAt: string;
}

export interface OngoingActivityLike {
  seasonId: string;
  seriesId: string;
  seriesTitle: string;
  episodeCount: number;
  lastScrapedAt: string | null;
  lastScrapeError: string | null;
}

/**
 * Hybrid derivation for the activity feed: `[Failed]` rows for active scrape
 * errors, `[Updated]` rows for recently updated series (no fabricated deltas).
 */
export function deriveActivityEvents(
  ongoingSeasons: OngoingActivityLike[],
  recentSeries: RecentSeriesLike[]
): ActivityEvent[] {
  const failed: ActivityEvent[] = ongoingSeasons
    .filter((s) => s.lastScrapeError)
    .map((s) => ({
      kind: 'failed' as const,
      key: `failed-${s.seasonId}`,
      title: s.seriesTitle,
      detail: `${s.episodeCount} eps in season`,
      timeIso: s.lastScrapedAt,
      seriesId: s.seriesId,
      seasonId: s.seasonId,
    }));
  const updated: ActivityEvent[] = [...recentSeries]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)
    .map((s) => ({
      kind: 'updated' as const,
      key: `updated-${s.id}`,
      title: s.title,
      detail: `${s.episodeCount} ${s.episodeCount === 1 ? 'episode' : 'episodes'} total`,
      timeIso: s.updatedAt,
      seriesId: s.id,
    }));
  return [...failed, ...updated];
}
