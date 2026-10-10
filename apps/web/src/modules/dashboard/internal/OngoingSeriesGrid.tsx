import { useState } from 'react';
import { ChunkyPaginationBar } from '@/components/ui/chunky-pagination';
import { OngoingCard } from './components/OngoingCard';
import { sortOngoingFailedFirst } from './formatters';
import { ONGOING_PAGE_SIZE, type OngoingSeriesGridProps } from './types';

export function OngoingSeriesGrid({ seasons, scrapingSeasonId, onScrape }: OngoingSeriesGridProps) {
  const [page, setPage] = useState(1);
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
  const totalPages = Math.max(1, Math.ceil(sorted.length / ONGOING_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const visibleSeasons = sorted.slice(
    (safePage - 1) * ONGOING_PAGE_SIZE,
    safePage * ONGOING_PAGE_SIZE
  );
  return (
    <>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleSeasons.map((item) => (
          <OngoingCard
            key={item.seasonId}
            item={item}
            isScraping={scrapingSeasonId === item.seasonId}
            onScrape={() => onScrape(item.seasonId)}
          />
        ))}
      </div>
      {totalPages > 1 && (
        <ChunkyPaginationBar
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
