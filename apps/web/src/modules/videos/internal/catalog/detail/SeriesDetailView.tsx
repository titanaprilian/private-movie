import { useEffect } from 'react';
import { Plus, Copy, Trash2 } from 'lucide-react';
import { DragDropContext } from '@hello-pangea/dnd';
import type { UpdateEpisodeData } from '../../api';
import { EpisodeTable } from '../../seasons';
import { EpisodeDetailDrawer } from '../../seasons';
import { BackButton } from '@/components/ui/back-button';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyChip } from '@/components/ui/chunky-chip';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import {
  ChunkyTable,
  ChunkyTableToolbar,
  ChunkyTableHeader,
  ChunkyTableBody,
  ChunkyTableRow,
  ChunkyTableCell,
} from '@/components/ui/chunky-table';
import { useSeriesDetail } from './hooks/useSeriesDetail';
import { useSeriesDetailDnd } from './hooks/useSeriesDetailDnd';
import { useSeriesDrawerSync } from './hooks/useSeriesDrawerSync';
import { useSeriesDetailModals } from './hooks/useSeriesDetailModals';
import { useEpisodeBatchOperations } from './hooks/useEpisodeBatchOperations';
import { SeriesDetailHero } from './components/SeriesDetailHero';
import { SeriesDetailSeasonBar } from './components/SeriesDetailSeasonBar';
import { SeriesDetailDialogs } from './components/SeriesDetailDialogs';
import type { SeriesDetailViewProps } from '../types';
export type { SeriesDetailViewProps } from '../types';

export function SeriesDetailView({
  seriesId,
  initialOrder,
  initialEpisodeId,
  initialSeasonId,
}: SeriesDetailViewProps) {
  const {
    series,
    isLoading,
    selectedSeasonId,
    setSelectedSeasonId,
    activeSeason,
    updateMutation,
    deleteMutation,
    deleteSeasonMutation,
    scrapeOngoingMutation,
    isEditSeasonOpen,
    setIsEditSeasonOpen,
    isAddSeasonOpen,
    setIsAddSeasonOpen,
    isDeleteSeasonOpen,
    setIsDeleteSeasonOpen,
    invalidateDetail,
  } = useSeriesDetail({ seriesId, initialSeasonId });

  const modals = useSeriesDetailModals();

  // useSeriesDetail closes its own delete-season flag when the mutation
  // settles; mirror that into the unified modal state so the OR-bridged
  // dialog below actually closes (preserves pre-refactor behavior).
  const deleteSeasonSettled =
    deleteSeasonMutation.isSuccess || deleteSeasonMutation.isError;
  const closeDeleteSeasonModal = modals.setIsDeleteSeasonOpen;
  useEffect(() => {
    if (deleteSeasonSettled) closeDeleteSeasonModal(false);
  }, [deleteSeasonSettled, closeDeleteSeasonModal]);

  const {
    selectedEpisodeIds,
    setSelectedEpisodeIds,
    clearSelection,
    isBatchOperating,
    handleBatchDelete,
  } = useEpisodeBatchOperations({
    onInvalidateDetail: invalidateDetail,
    onCloseBatchDeleteDialog: () => modals.setIsBatchDeleteOpen(false),
  });

  const {
    localEpisodes,
    seasonEpisodes: episodes,
    episodeCountBySeason,
    reorderMutation,
    handleDragEnd,
    handleBulkMoveEpisodes,
  } = useSeriesDetailDnd({
    seriesId,
    serverEpisodes: series?.episodes,
    seasons: series?.seasons,
    activeSeason,
    selectedEpisodeIds,
    onCloseMoveDialog: () => modals.setIsMoveEpisodesOpen(false),
    onBulkMoveSuccess: () => {
      clearSelection();
      modals.setIsMoveEpisodesOpen(false);
    },
  });

  const {
    selectedEpisodeId,
    setSelectedEpisodeId,
    isDrawerOpen,
    handleOpenEpisodeDrawer,
    handleCloseEpisodeDrawer,
  } = useSeriesDrawerSync({
    localEpisodes,
    initialEpisodeId,
    initialOrder,
  });

  const selectedEpisode = selectedEpisodeId
    ? episodes.find((e) => e.id === selectedEpisodeId) ?? null
    : null;

  const handleSaveDrawerEpisode = async (
    episodeId: string,
    data: UpdateEpisodeData
  ) => {
    await updateMutation.mutateAsync({ id: episodeId, data });
  };

  const handleConfirmDelete = () => {
    if (!selectedEpisode) return;
    deleteMutation.mutate(selectedEpisode.id);
    modals.setIsDeleteDialogOpen(false);
  };

  if (isLoading) {
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

  if (!series) {
    return (
      <div className="space-y-4">
        <BackButton />
        <div className="bg-[var(--surface)] border-2 border-b-4 border-[var(--border)] rounded-[var(--radius)] p-6 text-center">
          <h1 className="text-xl font-extrabold text-[var(--ink)]">Series not found</h1>
          <p className="text-sm font-semibold text-[var(--muted)] mt-1">
            No series matches <span className="font-mono text-[var(--ink)]">{seriesId}</span>.
          </p>
          <a
            href="/admin/videos"
            className="inline-flex items-center justify-center gap-2 h-11 px-4 mt-4 rounded-[14px] border-2 border-b-4 border-[var(--green)] bg-[var(--green-tint)] text-[var(--green)] font-extrabold text-[13px] uppercase tracking-[0.7px]"
          >
            Back to catalog
          </a>
        </div>
      </div>
    );
  }

  // Combined modal state bridge: useSeriesDetail manages season modal booleans,
  // while useSeriesDetailModals provides the unified setters and state.
  const modalProps = {
    isMoveEpisodesOpen: modals.isMoveEpisodesOpen,
    onMoveEpisodesOpenChange: modals.setIsMoveEpisodesOpen,
    isBatchDeleteOpen: modals.isBatchDeleteOpen,
    onBatchDeleteOpenChange: modals.setIsBatchDeleteOpen,
    isEditSeriesOpen: modals.isEditSeriesOpen,
    onEditSeriesOpenChange: modals.setIsEditSeriesOpen,
    isSyncTmdbOpen: modals.isSyncTmdbOpen,
    onSyncTmdbOpenChange: modals.setIsSyncTmdbOpen,
    isBulkScrapeOpen: modals.isBulkScrapeOpen,
    onBulkScrapeOpenChange: modals.setIsBulkScrapeOpen,
    bulkScrapeEpisodeIds: modals.bulkScrapeEpisodeIds,
    onBulkScrapeEpisodeIdsChange: modals.setBulkScrapeEpisodeIds,
    isBulkIngestOpen: modals.isBulkIngestOpen,
    onBulkIngestOpenChange: modals.setIsBulkIngestOpen,
    isEditSeasonOpen: isEditSeasonOpen || modals.isEditSeasonOpen,
    onEditSeasonOpenChange: (open: boolean) => {
      setIsEditSeasonOpen(open);
      modals.setIsEditSeasonOpen(open);
    },
    isAddSeasonOpen: isAddSeasonOpen || modals.isAddSeasonOpen,
    onAddSeasonOpenChange: (open: boolean) => {
      setIsAddSeasonOpen(open);
      modals.setIsAddSeasonOpen(open);
    },
    isDeleteSeasonOpen: isDeleteSeasonOpen || modals.isDeleteSeasonOpen,
    onDeleteSeasonOpenChange: (open: boolean) => {
      setIsDeleteSeasonOpen(open);
      modals.setIsDeleteSeasonOpen(open);
    },
    isEditDialogOpen: modals.isEditDialogOpen,
    onEditDialogOpenChange: modals.setIsEditDialogOpen,
    isManageSourcesOpen: modals.isManageSourcesOpen,
    onManageSourcesOpenChange: modals.setIsManageSourcesOpen,
    manageSourcesInitialTab: modals.manageSourcesInitialTab,
    onManageSourcesInitialTabChange: modals.setManageSourcesInitialTab,
    isDeleteDialogOpen: modals.isDeleteDialogOpen,
    onDeleteDialogOpenChange: modals.setIsDeleteDialogOpen,
  };

  return (
    <div className="space-y-4">
      {/* Top navigation */}
      <div>
        <BackButton />
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <SeriesDetailHero
          series={series}
          activeSeason={activeSeason}
          episodeCount={localEpisodes.length}
          onEditSeries={() => modals.setIsEditSeriesOpen(true)}
          onSyncTmdb={() => modals.setIsSyncTmdbOpen(true)}
          onBulkScrape={() => modals.handleOpenBulkScrape(null)}
          onBulkIngest={() => modals.setIsBulkIngestOpen(true)}
        />

        <SeriesDetailSeasonBar
          seasons={series.seasons}
          activeSeason={activeSeason}
          selectedSeasonId={selectedSeasonId}
          onSelectSeason={setSelectedSeasonId}
          onAddSeason={() => {
            setIsAddSeasonOpen(true);
            modals.setIsAddSeasonOpen(true);
          }}
          isScrapePending={scrapeOngoingMutation.isPending}
          onRunAutoScrape={(seasonId) => scrapeOngoingMutation.mutate(seasonId)}
          onEditSeason={() => {
            setIsEditSeasonOpen(true);
            modals.setIsEditSeasonOpen(true);
          }}
          onDeleteSeason={() => {
            setIsDeleteSeasonOpen(true);
            modals.setIsDeleteSeasonOpen(true);
          }}
        />

        {(!series.seasons || series.seasons.length === 0) && (
          <div
            className="bg-[var(--surface)] border-2 border-b-4 border-[var(--border)] rounded-[var(--radius)] p-6 text-center"
            role="region"
            aria-label="No seasons"
          >
            <h2 className="text-lg font-extrabold text-[var(--ink)]">
              No seasons yet
            </h2>
            <p className="text-sm font-semibold text-[var(--muted)] mt-1">
              This series has no seasons. Create the first season to start
              organizing episodes.
            </p>
            <ChunkyButton
              type="button"
              onClick={() => {
                setIsAddSeasonOpen(true);
                modals.setIsAddSeasonOpen(true);
              }}
              className="mt-4"
            >
              <Plus className="size-5" aria-hidden="true" />
              Create First Season
            </ChunkyButton>
          </div>
        )}

        {/* Full-Width Episode Data Table */}
        <EpisodeTable
          episodes={episodes}
          selectedEpisodeId={selectedEpisodeId}
          selectedEpisodeIds={selectedEpisodeIds}
          onSelectedEpisodeIdsChange={setSelectedEpisodeIds}
          onSelectEpisode={handleOpenEpisodeDrawer}
          onEditEpisode={handleOpenEpisodeDrawer}
          onDeleteEpisode={(ep) => {
            setSelectedEpisodeId(ep.id);
            modals.setIsDeleteDialogOpen(true);
          }}
          onManageSources={(ep) => {
            setSelectedEpisodeId(ep.id);
            modals.setIsManageSourcesOpen(true);
          }}
        />
        {selectedEpisodeIds.length > 0 && (
          <div className="bulkbar show" role="toolbar" aria-label="Bulk selection actions">
            <b>
              {selectedEpisodeIds.length} selected
            </b>
            <span className="sp" />
            <ChunkyChip
              variant="blue"
              type="button"
              onClick={() => modals.handleOpenBulkScrape([...selectedEpisodeIds])}
            >
              <Plus className="size-4" />
              Add sources
            </ChunkyChip>
            <ChunkyChip
              variant="blue"
              type="button"
              onClick={() => modals.setIsMoveEpisodesOpen(true)}
            >
              <Copy className="size-4" />
              Move to Season
            </ChunkyChip>
            <ChunkyChip
              variant="danger"
              type="button"
              onClick={() => modals.setIsBatchDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </ChunkyChip>
          </div>
        )}
        {/* Slide-Out Episode Detail Drawer */}
        <EpisodeDetailDrawer
          open={isDrawerOpen}
          onOpenChange={handleCloseEpisodeDrawer}
          episode={selectedEpisode}
          onSave={handleSaveDrawerEpisode}
          isSaving={updateMutation.isPending}
          onOpenAdvancedIngest={(tab) => {
            modals.handleOpenManageSources(tab);
          }}
        />
        <SeriesDetailDialogs
          series={series}
          seriesId={seriesId}
          seasons={series.seasons}
          activeSeason={activeSeason}
          localEpisodes={localEpisodes}
          selectedEpisode={selectedEpisode}
          selectedEpisodeIds={selectedEpisodeIds}
          episodeCountBySeason={episodeCountBySeason}
          updateMutation={updateMutation}
          modals={modalProps}
          onConfirmBulkMove={handleBulkMoveEpisodes}
          isMovePending={reorderMutation.isPending}
          onConfirmBatchDelete={handleBatchDelete}
          isBatchOperating={isBatchOperating}
          isDeleteSeasonPending={deleteSeasonMutation.isPending}
          onConfirmDeleteSeason={() => {
            if (series.seasons && series.seasons.length <= 1) return;
            if (activeSeason) {
              deleteSeasonMutation.mutate(activeSeason.id);
            }
          }}
          onConfirmDeleteEpisode={handleConfirmDelete}
        />
      </DragDropContext>
    </div>
  );
}
