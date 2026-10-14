import { BackButton } from '@/components/ui/back-button';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import {
  ChunkyTable,
  ChunkyTableToolbar,
  ChunkyTableHeader,
  ChunkyTableBody,
  ChunkyTableRow,
  ChunkyTableCell,
} from '@/components/ui/chunky-table';

export function SeriesDetailSkeleton() {
  return (
    <div
      className="space-y-4"
      data-testid="series-detail-skeleton"
      aria-busy="true"
      aria-label="Loading series details"
    >
      {/* Top navigation */}
      <div>
        <BackButton />
      </div>

      {/* Hero skeleton: poster, title badges, and action buttons */}
      <div className="hero" data-testid="series-detail-hero-skeleton">
        <ChunkySkeleton className="w-[104px] aspect-[3/4] rounded-xl flex-none" />
        <div className="hero-body">
          <div className="hero-title">
            <ChunkySkeleton className="h-7 w-48 rounded-lg" />
            <ChunkySkeleton className="h-8 w-24 rounded-full" />
            <ChunkySkeleton className="h-8 w-24 rounded-full" />
          </div>
          <div className="hero-desc-wrap">
            <ChunkySkeleton className="h-12 w-full rounded-lg" />
          </div>
          <div className="hero-actions">
            <ChunkySkeleton className="h-11 w-28 rounded-[14px]" />
            <ChunkySkeleton className="h-11 w-32 rounded-[14px]" />
            <ChunkySkeleton className="h-11 w-36 rounded-[14px]" />
            <ChunkySkeleton className="h-11 w-36 rounded-2xl" />
          </div>
        </div>
      </div>

      {/* Season bar skeleton: reserves space for the season navigation bar */}
      <div
        className="season-bar"
        data-testid="series-detail-seasonbar-skeleton"
      >
        <span className="lbl">SEASON:</span>
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <ChunkySkeleton
            data-testid="season-chip-skeleton"
            className="h-9 w-24 rounded-[14px]"
          />
          <ChunkySkeleton
            data-testid="season-chip-skeleton"
            className="h-9 w-24 rounded-[14px]"
          />
          <ChunkySkeleton
            data-testid="season-chip-skeleton"
            className="h-9 w-28 rounded-[14px]"
          />
        </div>
      </div>

      {/* Episode table skeleton: search toolbar, header, and episode rows */}
      <div data-testid="series-detail-episode-table-skeleton">
        <ChunkyTable>
          <ChunkyTableToolbar
            data-testid="episode-table-toolbar-skeleton"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <ChunkySkeleton className="h-11 w-full max-w-[380px] rounded-[14px]" />
            <ChunkySkeleton className="h-4 w-20 rounded-md" />
          </ChunkyTableToolbar>

          <div className="w-full">
            <ChunkyTableHeader
              data-testid="episode-table-header-skeleton"
              className="grid-cols-[24px_20px_44px_minmax(0,1fr)_84px_76px_92px_116px_40px]"
              role="row"
            >
              <ChunkySkeleton className="h-4 w-4 rounded" />
              <span aria-hidden="true" />
              <ChunkySkeleton className="h-4 w-8 rounded" />
              <ChunkySkeleton className="h-4 w-24 rounded" />
              <ChunkySkeleton className="h-4 w-12 rounded" />
              <ChunkySkeleton className="h-4 w-12 rounded" />
              <ChunkySkeleton className="h-4 w-16 rounded" />
              <ChunkySkeleton className="h-4 w-20 rounded" />
              <span aria-hidden="true" />
            </ChunkyTableHeader>

            <ChunkyTableBody>
              {Array.from({ length: 5 }).map((_, index) => (
                <ChunkyTableRow
                  key={index}
                  data-testid="episode-row-skeleton"
                  className="grid grid-cols-[24px_20px_44px_minmax(0,1fr)_84px_76px_92px_116px_40px] items-center gap-3.5 px-4 py-3"
                >
                  <ChunkyTableCell className="flex items-center justify-center">
                    <ChunkySkeleton className="h-5 w-5 rounded-md" />
                  </ChunkyTableCell>
                  <span aria-hidden="true" />
                  <ChunkyTableCell>
                    <ChunkySkeleton className="h-10 w-10 rounded-xl" />
                  </ChunkyTableCell>
                  <ChunkyTableCell className="space-y-2">
                    <ChunkySkeleton className="h-4 w-3/4 rounded" />
                    <ChunkySkeleton className="h-3 w-1/2 rounded" />
                  </ChunkyTableCell>
                  <ChunkyTableCell>
                    <ChunkySkeleton className="h-4 w-12 rounded" />
                  </ChunkyTableCell>
                  <ChunkyTableCell>
                    <ChunkySkeleton className="h-6 w-16 rounded-full" />
                  </ChunkyTableCell>
                  <ChunkyTableCell>
                    <ChunkySkeleton className="h-4 w-14 rounded" />
                  </ChunkyTableCell>
                  <ChunkyTableCell>
                    <ChunkySkeleton className="h-9 w-24 rounded-[14px]" />
                  </ChunkyTableCell>
                  <span aria-hidden="true" />
                </ChunkyTableRow>
              ))}
            </ChunkyTableBody>
          </div>
        </ChunkyTable>
      </div>
    </div>
  );
}
