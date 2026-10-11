import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PackageSearch, Search } from 'lucide-react';
import { formatDualBytes, type StorageSeriesItem } from '../api';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { ChunkyActionMenu } from '@/components/ui/chunky-action-menu';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import {
  ChunkyTable,
  ChunkyTableBody,
  ChunkyTableCell,
  ChunkyTableHeader,
  ChunkyTableHeaderCell,
  ChunkyTableIndexBadge,
  ChunkyTableRow,
  ChunkyTableToolbar,
} from '@/components/ui/chunky-table';

export interface StorageSeriesTableProps {
  series: StorageSeriesItem[];
  isLoading?: boolean;
  selectedSeriesId?: string | null;
  onSelectSeries?: (series: StorageSeriesItem) => void;
  /** Active storage provider, forwarded as search state on row navigation. */
  providerId?: string | null;
}

export function StorageSeriesTable({
  series,
  isLoading = false,
  selectedSeriesId = null,
  onSelectSeries,
  providerId = null,
}: StorageSeriesTableProps) {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const filteredSeries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return series;
    return series.filter((s) => s.title.toLowerCase().includes(query));
  }, [series, search]);

  const handleSelectSeries = (item: StorageSeriesItem) => {
    onSelectSeries?.(item);
    void navigate({
      to: '/admin/storage/$seriesId',
      params: { seriesId: item.id },
      search: providerId ? { providerId } : {},
    });
  };

  return (
    <ChunkyTable data-testid="series-table-container">
      <ChunkyTableToolbar>
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
      </ChunkyTableToolbar>

      {/* Grid Header Row */}
      <ChunkyTableHeader className="px-4 pb-2 grid-cols-[36px_minmax(0,2fr)_110px_190px_110px_48px]">
        <ChunkyTableHeaderCell data-testid="series-header-index">
          #
        </ChunkyTableHeaderCell>
        <ChunkyTableHeaderCell>Series Title</ChunkyTableHeaderCell>
        <ChunkyTableHeaderCell>Files</ChunkyTableHeaderCell>
        <ChunkyTableHeaderCell>Storage Used</ChunkyTableHeaderCell>
        <ChunkyTableHeaderCell>Seasons</ChunkyTableHeaderCell>
        <ChunkyTableHeaderCell aria-hidden="true" />
      </ChunkyTableHeader>

      {isLoading ? (
        <ChunkyTableBody data-testid="series-loading-list">
          {[1, 2, 3].map((i) => (
            <ChunkySkeleton key={i} className="p-4">
              <div className="h-4 bg-[var(--border)] rounded-xl w-2/3 mb-2" />
              <div className="h-3 bg-[var(--border)] rounded-xl w-1/3" />
            </ChunkySkeleton>
          ))}
          <p className="text-center font-sans text-xs font-bold text-[var(--muted)]">
            Aggregating series storage...
          </p>
        </ChunkyTableBody>
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
        <ChunkyTableBody>
          {filteredSeries.map((item, index) => {
            const isSelected = selectedSeriesId === item.id;
            return (
              <ChunkyTableRow
                key={item.id}
                selected={isSelected}
                interactive
                className="p-3 items-center grid gap-3 grid-cols-[36px_minmax(0,1fr)_48px] lg:grid-cols-[36px_minmax(0,2fr)_110px_190px_110px_48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
                data-testid={`series-row-${item.id}`}
                onClick={() => handleSelectSeries(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectSeries(item);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <ChunkyTableIndexBadge
                  index={index + 1}
                  className="ep-num"
                  data-testid={`series-row-index-${item.id}`}
                />

                <ChunkyTableCell>
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
                </ChunkyTableCell>

                <ChunkyTableCell
                  className="hidden lg:block font-mono text-sm font-extrabold text-[var(--ink)]"
                  data-testid={`series-row-files-${item.id}`}
                >
                  {item.s3SourceCount}
                </ChunkyTableCell>

                <ChunkyTableCell
                  className="hidden lg:block font-mono text-sm font-extrabold text-[var(--ink)]"
                  data-testid={`series-row-size-${item.id}`}
                >
                  {formatDualBytes(item.s3SizeBytes)}
                </ChunkyTableCell>

                <ChunkyTableCell
                  className="hidden lg:block font-mono text-sm font-extrabold text-[var(--ink)]"
                  data-testid={`series-row-seasons-${item.id}`}
                >
                  {item.seasons.length}
                </ChunkyTableCell>

                <ChunkyTableCell
                  className="flex items-center justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ChunkyActionMenu
                    triggerLabel={`Actions for ${item.title}`}
                    items={[
                      {
                        label: 'Inspect Storage',
                        icon: <PackageSearch className="w-4 h-4" />,
                        onSelect: () => handleSelectSeries(item),
                      },
                    ]}
                  />
                </ChunkyTableCell>
              </ChunkyTableRow>
            );
          })}
        </ChunkyTableBody>
      )}
    </ChunkyTable>
  );
}
