import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { formatDualBytes, type StorageSeriesItem } from '../api';
import { ChunkyCard, ChunkyCardList } from '@/components/ui/chunky-card';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';

export interface StorageSeriesTableProps {
  series: StorageSeriesItem[];
  isLoading?: boolean;
  selectedSeriesId?: string | null;
  onSelectSeries: (series: StorageSeriesItem) => void;
}

export function StorageSeriesTable({
  series,
  isLoading = false,
  selectedSeriesId = null,
  onSelectSeries,
}: StorageSeriesTableProps) {
  const [search, setSearch] = useState('');

  const filteredSeries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return series;
    return series.filter((s) => s.title.toLowerCase().includes(query));
  }, [series, search]);

  return (
    <div className="space-y-4" data-testid="series-table-container">
      <ChunkyCard className="p-3 sm:p-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
          <ChunkyInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search series..."
            className="pl-10 font-mono"
            data-testid="series-search-input"
          />
        </div>
      </ChunkyCard>

      {/* Grid Header Row */}
      <div className="hidden lg:grid gap-3.5 items-center px-4 pb-2 grid-cols-[minmax(0,2fr)_110px_190px_110px]">
        <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
          Series Title
        </span>
        <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
          Files
        </span>
        <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
          Storage Used
        </span>
        <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
          Seasons
        </span>
      </div>

      {isLoading ? (
        <ChunkyCardList data-testid="series-loading-list">
          {[1, 2, 3].map((i) => (
            <ChunkySkeleton key={i} className="p-4">
              <div className="h-4 bg-[var(--border)] rounded-xl w-2/3 mb-2" />
              <div className="h-3 bg-[var(--border)] rounded-xl w-1/3" />
            </ChunkySkeleton>
          ))}
          <p className="text-center font-sans text-xs font-bold text-[var(--muted)]">
            Aggregating series storage...
          </p>
        </ChunkyCardList>
      ) : filteredSeries.length === 0 ? (
        <ChunkyCard className="p-8 text-center" data-testid="series-empty-state">
          <p className="font-display font-bold text-lg text-[var(--ink)]">
            No series found
          </p>
          <p className="font-sans text-sm font-semibold text-[var(--muted)] mt-1">
            {series.length === 0
              ? 'No catalogued series have video files stored yet.'
              : 'No series match your search.'}
          </p>
        </ChunkyCard>
      ) : (
        <ChunkyCardList>
          {filteredSeries.map((item) => {
            const isSelected = selectedSeriesId === item.id;
            return (
              <ChunkyCard
                key={item.id}
                selected={isSelected}
                interactive
                className="p-3 items-center grid gap-3 grid-cols-[minmax(0,1fr)_48px] lg:grid-cols-[minmax(0,2fr)_110px_190px_110px] cursor-pointer"
                data-testid={`series-row-${item.id}`}
                onClick={() => onSelectSeries(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectSeries(item);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="min-w-0">
                  <div
                    className="font-sans font-extrabold text-[15px] text-[var(--ink)] leading-snug truncate"
                    title={item.title}
                  >
                    {item.title}
                  </div>
                  <div className="lg:hidden mt-1 font-mono text-xs font-bold text-[var(--ink)]">
                    {item.s3SourceCount} file{item.s3SourceCount === 1 ? '' : 's'}
                    {' · '}
                    {formatDualBytes(item.s3SizeBytes)}
                    {' · '}
                    {item.seasons.length} season{item.seasons.length === 1 ? '' : 's'}
                  </div>
                </div>

                <div
                  className="hidden lg:block font-mono text-sm font-extrabold text-[var(--ink)]"
                  data-testid={`series-row-files-${item.id}`}
                >
                  {item.s3SourceCount}
                </div>

                <div
                  className="hidden lg:block font-mono text-sm font-extrabold text-[var(--ink)]"
                  data-testid={`series-row-size-${item.id}`}
                >
                  {formatDualBytes(item.s3SizeBytes)}
                </div>

                <div
                  className="hidden lg:block font-mono text-sm font-extrabold text-[var(--ink)]"
                  data-testid={`series-row-seasons-${item.id}`}
                >
                  {item.seasons.length}
                </div>

                <span className="lg:hidden flex justify-end font-mono text-xs font-bold text-[var(--muted)]">
                  ›
                </span>
              </ChunkyCard>
            );
          })}
        </ChunkyCardList>
      )}
    </div>
  );
}
