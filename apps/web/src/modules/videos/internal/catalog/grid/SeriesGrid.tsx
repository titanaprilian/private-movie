import { Plus, Search, Star } from 'lucide-react';
import { AddMediaDialog } from '../dialogs/AddMediaDialog';
import { EditSeriesDialog } from '../dialogs/EditSeriesDialog';
import { SeriesCard } from './components/SeriesCard';
import { GenreFilter } from './components/GenreFilter';
import { useSeriesGrid } from './hooks/useSeriesGrid';
import type { SeriesCardItem } from '../types';
import { ChunkyConfirmDialog } from '@/components/ui/chunky-confirm-dialog';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import { ChunkyTooltip } from '@/components/ui/chunky-tooltip';
import { ChunkyPaginationBar } from '@/components/ui/chunky-pagination';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyChip } from '@/components/ui/chunky-chip';
import {
  ChunkyTabs,
  ChunkyTabsList,
  ChunkyTabsTrigger,
} from '@/components/ui/chunky-tabs';

export function SeriesGrid() {
  const {
    currentPage,
    activeTab,
    highlightedOnly,
    selectedSlugs,
    inputValue,
    setInputValue,
    totalPages,
    handleToggleHighlightedOnly,
    handleTabChange,
    handleGenreSelectionChange,
    handleToggleGenre,
    gridTopRef,
    goToPage,
    seriesList,
    isLoading,
    meta,
    bigGenres,
    highlightedCountByGenreSlug,
    editingSeries,
    setEditingSeries,
    deletingSeries,
    setDeletingSeries,
    openDialog,
    deleteMutation,
    handleToggleFeatured,
    handleToggleHighlight,
    handleOpenEdit,
    handleOpenDelete,
  } = useSeriesGrid();

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight">Series</h1>
          <p className="text-[15px] font-semibold text-[var(--muted)]">
            Manage and browse your series catalog.
          </p>
        </div>
        <ChunkyButton
          type="button"
          variant="primary"
          onClick={openDialog}
        >
          <Plus size={14} strokeWidth={2} aria-hidden="true" />
          Add series
        </ChunkyButton>
      </div>

      {/* Chunky Filter Tabs: All, Featured, Ongoing */}
      <ChunkyTabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full sm:w-auto"
      >
        <ChunkyTabsList className="grid grid-cols-3 sm:inline-flex w-full sm:w-auto">
          <ChunkyTabsTrigger value="all">All</ChunkyTabsTrigger>
          <ChunkyTabsTrigger value="featured">Featured</ChunkyTabsTrigger>
          <ChunkyTabsTrigger value="ongoing">Ongoing</ChunkyTabsTrigger>
        </ChunkyTabsList>
      </ChunkyTabs>

      {/* Big Genre quick-filter chips + Highlighted Only toggle (ongoing tab) */}
      {activeTab === 'ongoing' && (
        <div className="bg-[var(--surface)] border-2 border-[var(--border)] rounded-[16px] p-3 space-y-2.5">
          {bigGenres.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap" aria-label="Filter by big genre">
              {bigGenres.map((genre) => {
                const isActive = selectedSlugs.includes(genre.slug);
                const highlightedCount =
                  highlightedCountByGenreSlug.get(genre.slug) ?? 0;
                return (
                  <ChunkyChip
                    key={genre.id}
                    type="button"
                    variant={isActive ? 'active' : 'default'}
                    pressed={isActive}
                    onClick={() => handleToggleGenre(genre.slug)}
                  >
                    <span>{genre.name}</span>
                    <ChunkyTooltip
                      content={`${highlightedCount} highlighted in ${genre.name}`}
                    >
                      <span
                        aria-label={`${highlightedCount} highlighted in ${genre.name}`}
                        className={`inline-flex items-center justify-center min-w-5 h-4 px-1 rounded text-[10px] font-semibold ${
                          isActive
                            ? 'bg-[var(--green-dark)]/20 text-[var(--green)]'
                            : 'bg-[var(--green)]/10 text-[var(--green)]'
                        }`}
                      >
                        {highlightedCount}
                      </span>
                    </ChunkyTooltip>
                  </ChunkyChip>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-2">
            <ChunkyChip
              type="button"
              variant={highlightedOnly ? 'gold' : 'default'}
              pressed={highlightedOnly}
              role="switch"
              aria-checked={highlightedOnly}
              aria-label="Highlighted Only"
              onClick={handleToggleHighlightedOnly}
            >
              <Star
                size={14}
                strokeWidth={2}
                fill={highlightedOnly ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
              <span>★ Highlighted Only</span>
            </ChunkyChip>
          </div>
        </div>
      )}

      {/* Toolbar: debounced search, genre filter, result count */}
      <ChunkyCard className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
              <ChunkyInput
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Filter series..."
                aria-label="Search series"
                className="pl-10 font-mono"
              />
            </div>
            <GenreFilter
              selectedSlugs={selectedSlugs}
              onSelectionChange={handleGenreSelectionChange}
            />
          </div>
          {isLoading ? (
            <ChunkySkeleton
              data-testid="series-count-skeleton"
              className="ml-auto h-5 w-20"
            />
          ) : (
            <span className="ml-auto font-extrabold text-[14px] text-[var(--muted)]" aria-live="polite">
              {meta.total} series
            </span>
          )}
        </div>
      </ChunkyCard>

      {/* Grid view */}
      <div ref={gridTopRef} className="scroll-mt-20">
      {isLoading ? (
        <div
          data-testid="series-grid"
          className="grid gap-4"
          style={{
            gridTemplateColumns:
              'repeat(auto-fill, minmax(max(210px, calc((100% - 60px) / 4)), 1fr))',
          }}
        >
          {Array.from({ length: 12 }).map((_, index) => (
            <div
              key={index}
              data-testid="series-card-skeleton"
              className="bg-card border border-c rounded-[16px] overflow-hidden flex flex-col"
            >
              <ChunkySkeleton className="aspect-[3/4] w-full rounded-none border-0" />
              <div className="space-y-2 p-3">
                <ChunkySkeleton className="h-4 w-3/4" />
                <ChunkySkeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : seriesList.length === 0 ? (
        <div className="bg-card border border-c rounded p-8 text-center text-xs text-muted mono">
          No series match your filter.
        </div>
      ) : (
        <div
          data-testid="series-grid"
          className="grid gap-4"
          style={{
            gridTemplateColumns:
              'repeat(auto-fill, minmax(max(210px, calc((100% - 60px) / 4)), 1fr))',
          }}
        >
          {seriesList.map((item: SeriesCardItem) => (
            <SeriesCard
              key={item.id}
              item={item}
              onToggleFeatured={handleToggleFeatured}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
              onToggleHighlight={handleToggleHighlight}
            />
          ))}
        </div>
      )}
      </div>

      {/* Pagination Bar */}
      {!isLoading && meta.total > 0 && (
        <ChunkyPaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
        />
      )}

      {/* Edit Series Dialog */}
      {editingSeries && (
        <EditSeriesDialog
          open={!!editingSeries}
          onOpenChange={(open) => !open && setEditingSeries(null)}
          series={editingSeries}
          seriesList={seriesList}
        />
      )}

      {/* Delete Series Confirmation Dialog */}
      <ChunkyConfirmDialog
        open={!!deletingSeries}
        onOpenChange={(open) => !open && setDeletingSeries(null)}
        title="Delete Series"
        description={
          deletingSeries?.title
            ? `Are you sure you want to delete "${deletingSeries.title}"? This action cannot be undone.`
            : 'Are you sure you want to delete this series? This action cannot be undone.'
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingSeries) {
            deleteMutation.mutate(deletingSeries.id);
          }
        }}
      />

      <AddMediaDialog />
    </div>
  );
}
