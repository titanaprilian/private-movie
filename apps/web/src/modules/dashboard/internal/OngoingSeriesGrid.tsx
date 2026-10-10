import { Link } from '@tanstack/react-router';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import type { AdminDashboardOngoingSeason } from './api';
import type { OngoingSeriesGridProps } from './types';
import {
  formatRelativeTime,
  formatSeasonMeta,
  parseScrapeError,
  sortOngoingFailedFirst,
  truncateErrorMessage,
} from './formatters';

function Poster({ title, posterUrl }: { title: string; posterUrl: string | null }) {
  if (posterUrl) {
    return (
      <img
        src={posterUrl}
        alt={`${title} poster`}
        loading="lazy"
        className="h-[108px] w-[76px] shrink-0 rounded-xl border-2 border-[var(--border)] object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="grid h-[108px] w-[76px] shrink-0 place-items-center rounded-xl border-2 border-[var(--border)] bg-[var(--surface-raised)] font-display text-lg font-extrabold text-[var(--muted)]"
    >
      {title.charAt(0).toUpperCase()}
    </div>
  );
}

function OngoingCard({
  item,
  isScraping,
  onScrape,
}: {
  item: AdminDashboardOngoingSeason;
  isScraping: boolean;
  onScrape: () => void;
}) {
  const failed = Boolean(item.lastScrapeError);
  const parsed = failed ? parseScrapeError(item.lastScrapeError) : null;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const raw = (item.lastScrapeError ?? '').trim();
    if (!raw) return;
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      data-testid={`ongoing-card-${item.seasonId}`}
      className={`min-w-0 overflow-hidden rounded-2xl border bg-[var(--surface)] p-4 ${
        failed
          ? 'border-red-400 border-b-4 bg-red-50/60 dark:border-red-800 dark:bg-red-950/30'
          : 'border-[var(--border)] border-b-4'
      }`}
    >
      <div className="flex gap-3">
        <Link
          to="/admin/videos/$seriesId"
          params={{ seriesId: item.seriesId }}
          aria-label={`Manage ${item.seriesTitle}`}
          className="shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-[var(--blue)]"
        >
          <Poster title={item.seriesTitle} posterUrl={item.posterUrl} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to="/admin/videos/$seriesId"
            params={{ seriesId: item.seriesId }}
            aria-label={`Manage ${item.seriesTitle}`}
            title={item.seriesTitle}
            className="block font-display text-base font-extrabold tracking-tight text-[var(--ink)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--blue)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden"
          >
            {item.seriesTitle}
          </Link>
          <div
            data-testid={`ongoing-meta-${item.seasonId}`}
            className="mt-0.5 truncate font-sans text-xs font-semibold text-[var(--muted)]"
          >
            {formatSeasonMeta(item.seasonNumber, item.episodeCount)}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${failed ? 'bg-red-500' : 'bg-[var(--green)]'}`}
            />
            <span
              data-testid={`ongoing-scraped-${item.seasonId}`}
              data-status-testid={`ongoing-status-${item.seasonId}`}
              className={`truncate font-sans text-xs font-semibold ${failed ? 'text-red-700 dark:text-red-400' : 'text-[var(--muted)]'}`}
            >
              {failed
                ? `Scrape failed · ${item.lastScrapedAt ? formatRelativeTime(item.lastScrapedAt) : 'never synced'}`
                : `Synced · ${item.lastScrapedAt ? formatRelativeTime(item.lastScrapedAt) : 'never synced'}`}
              <span className="sr-only">
                {item.lastScrapedAt
                  ? `Scraped ${formatRelativeTime(item.lastScrapedAt)}`
                  : 'Never scraped'}
              </span>
            </span>
          </div>
          {/* Back-compat episode count badge for existing tests */}
          <span data-testid={`ongoing-episodes-${item.seasonId}`} className="sr-only">
            {item.episodeCount} {item.episodeCount === 1 ? 'episode' : 'episodes'}
          </span>
        </div>
        <button
          type="button"
          onClick={onScrape}
          disabled={isScraping}
          aria-label={`Scrape ${item.seriesTitle}`}
          data-testid={`ongoing-scrape-${item.seasonId}`}
          className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface-raised)] text-[var(--ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--blue)]"
        >
          <RefreshCw aria-hidden="true" className={`h-4 w-4 ${isScraping ? 'animate-spin' : ''}`} />
          <span className="sr-only">{isScraping ? 'Scraping…' : 'Scrape'}</span>
        </button>
      </div>
      {failed && parsed && (
        <div className="mt-3">
          <div
            data-testid={`ongoing-error-${item.seasonId}`}
            title={item.lastScrapeError ?? undefined}
            role="alert"
            className="font-sans text-xs font-bold text-red-700 dark:text-red-400 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden"
          >
            {parsed.friendly}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <code
              data-testid={`ongoing-error-raw-${item.seasonId}`}
              title={item.lastScrapeError ?? undefined}
              className="min-w-0 flex-1 truncate rounded-lg border border-red-200 bg-red-100/70 px-2 py-1 font-mono text-[11px] text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300"
            >
              {truncateErrorMessage(item.lastScrapeError ?? '', 120)}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              data-testid={`ongoing-error-copy-${item.seasonId}`}
              aria-label={`Copy error for ${item.seriesTitle}`}
              className="shrink-0 cursor-pointer rounded-lg border border-[var(--border)] px-2 py-1 font-sans text-[11px] font-bold text-[var(--muted)] focus-visible:outline-2 focus-visible:outline-[var(--blue)]"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <ChunkyButton
            variant="outline"
            size="sm"
            onClick={onScrape}
            disabled={isScraping}
            aria-label={`Retry scraping ${item.seriesTitle}`}
            data-testid={`ongoing-retry-${item.seasonId}`}
            className="mt-2 w-full"
          >
            <RotateCcw aria-hidden="true" className={isScraping ? 'animate-spin' : ''} />
            {isScraping ? 'Retrying…' : 'Retry'}
          </ChunkyButton>
        </div>
      )}
    </div>
  );
}

export function OngoingSeriesGrid({ seasons, scrapingSeasonId, onScrape }: OngoingSeriesGridProps) {
  const sorted = sortOngoingFailedFirst(seasons);
  if (sorted.length === 0) {
    return (
      <div
        data-testid="ongoing-empty"
        className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 font-sans text-sm font-semibold text-[var(--muted)]"
      >
        No seasons are marked as ongoing. Mark a season as ongoing to enable auto-scraping.
      </div>
    );
  }
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((item) => (
        <OngoingCard
          key={item.seasonId}
          item={item}
          isScraping={scrapingSeasonId === item.seasonId}
          onScrape={() => onScrape(item.seasonId)}
        />
      ))}
    </div>
  );
}
