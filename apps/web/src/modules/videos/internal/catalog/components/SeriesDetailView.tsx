import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Copy, Trash2 } from 'lucide-react';
import { DragDropContext } from '@hello-pangea/dnd';
import {
  deleteEpisode,
  type UpdateEpisodeData,
} from '../../api';
import { EpisodeTable } from '../../seasons/EpisodeTable';
import { EpisodeDetailDrawer } from '../../seasons/EpisodeDetailDrawer';
import { BackButton } from '@/components/ui/back-button';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyChip } from '@/components/ui/chunky-chip';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import { useSeriesDetail } from '../hooks/useSeriesDetail';
import { useSeriesDetailDnd } from '../hooks/useSeriesDetailDnd';
import { useSeriesDrawerSync } from '../hooks/useSeriesDrawerSync';
import { SeriesDetailHero } from './SeriesDetailHero';
import { SeriesDetailSeasonBar } from './SeriesDetailSeasonBar';
import { SeriesDetailDialogs } from './SeriesDetailDialogs';
import type { ManageSourcesInitialTab, SeriesDetailViewProps } from '../types';
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

  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<string[]>([]);
  const [isMoveEpisodesOpen, setIsMoveEpisodesOpen] = useState(false);

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
    onCloseMoveDialog: () => setIsMoveEpisodesOpen(false),
    onBulkMoveSuccess: () => {
      setSelectedEpisodeIds([]);
      setIsMoveEpisodesOpen(false);
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

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isManageSourcesOpen, setIsManageSourcesOpen] = useState(false);
  const [manageSourcesInitialTab, setManageSourcesInitialTab] = useState<
    ManageSourcesInitialTab | undefined
  >(undefined);
  const [isEditSeriesOpen, setIsEditSeriesOpen] = useState(false);
  const [isSyncTmdbOpen, setIsSyncTmdbOpen] = useState(false);
  const [isBulkScrapeOpen, setIsBulkScrapeOpen] = useState(false);
  const [isBulkIngestOpen, setIsBulkIngestOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isBatchOperating, setIsBatchOperating] = useState(false);
  const [bulkScrapeEpisodeIds, setBulkScrapeEpisodeIds] = useState<string[] | null>(null);

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
    setIsDeleteDialogOpen(false);
  };

  const handleBatchDelete = async () => {
    if (selectedEpisodeIds.length === 0) return;
    setIsBatchOperating(true);

    let successCount = 0;
    const errors: string[] = [];

    for (const epId of selectedEpisodeIds) {
      try {
        await deleteEpisode(epId);
        successCount++;
      } catch (err) {
        errors.push((err as Error).message);
      }
    }

    await invalidateDetail();
    setSelectedEpisodeIds([]);
    setIsBatchDeleteOpen(false);
    setIsBatchOperating(false);

    if (successCount > 0) {
      toast.success(
        `Successfully deleted ${successCount} ${
          successCount === 1 ? 'episode' : 'episodes'
        }`
      );
    }
    if (errors.length > 0) {
      toast.error(
        `Failed to delete ${errors.length} ${
          errors.length === 1 ? 'episode' : 'episodes'
        }`
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="hero">
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
        <div className="flex flex-col gap-3" aria-label="Loading episodes">
          <ChunkySkeleton className="h-[68px] w-full rounded-[var(--radius)]" />
          <ChunkySkeleton className="h-[68px] w-full rounded-[var(--radius)]" />
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
          onEditSeries={() => setIsEditSeriesOpen(true)}
          onSyncTmdb={() => setIsSyncTmdbOpen(true)}
          onBulkScrape={() => {
            setBulkScrapeEpisodeIds(null);
            setIsBulkScrapeOpen(true);
          }}
          onBulkIngest={() => setIsBulkIngestOpen(true)}
        />

        <SeriesDetailSeasonBar
          seasons={series.seasons}
          activeSeason={activeSeason}
          selectedSeasonId={selectedSeasonId}
          onSelectSeason={setSelectedSeasonId}
          onAddSeason={() => setIsAddSeasonOpen(true)}
          isScrapePending={scrapeOngoingMutation.isPending}
          onRunAutoScrape={(seasonId) => scrapeOngoingMutation.mutate(seasonId)}
          onEditSeason={() => setIsEditSeasonOpen(true)}
          onDeleteSeason={() => setIsDeleteSeasonOpen(true)}
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
              onClick={() => setIsAddSeasonOpen(true)}
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
            setIsDeleteDialogOpen(true);
          }}
          onManageSources={(ep) => {
            setSelectedEpisodeId(ep.id);
            setIsManageSourcesOpen(true);
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
              onClick={() => {
                setBulkScrapeEpisodeIds([...selectedEpisodeIds]);
                setIsBulkScrapeOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add sources
            </ChunkyChip>
            <ChunkyChip
              variant="blue"
              type="button"
              onClick={() => setIsMoveEpisodesOpen(true)}
            >
              <Copy className="size-4" />
              Move to Season
            </ChunkyChip>
            <ChunkyChip
              variant="danger"
              type="button"
              onClick={() => setIsBatchDeleteOpen(true)}
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
            setManageSourcesInitialTab(tab);
            setIsManageSourcesOpen(true);
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
          isMoveEpisodesOpen={isMoveEpisodesOpen}
          onMoveEpisodesOpenChange={setIsMoveEpisodesOpen}
          onConfirmBulkMove={handleBulkMoveEpisodes}
          isMovePending={reorderMutation.isPending}
          isBatchDeleteOpen={isBatchDeleteOpen}
          onBatchDeleteOpenChange={setIsBatchDeleteOpen}
          onConfirmBatchDelete={handleBatchDelete}
          isBatchOperating={isBatchOperating}
          isEditSeriesOpen={isEditSeriesOpen}
          onEditSeriesOpenChange={setIsEditSeriesOpen}
          isSyncTmdbOpen={isSyncTmdbOpen}
          onSyncTmdbOpenChange={setIsSyncTmdbOpen}
          isBulkScrapeOpen={isBulkScrapeOpen}
          onBulkScrapeOpenChange={setIsBulkScrapeOpen}
          bulkScrapeEpisodeIds={bulkScrapeEpisodeIds}
          onBulkScrapeEpisodeIdsChange={setBulkScrapeEpisodeIds}
          isBulkIngestOpen={isBulkIngestOpen}
          onBulkIngestOpenChange={setIsBulkIngestOpen}
          isEditSeasonOpen={isEditSeasonOpen}
          onEditSeasonOpenChange={setIsEditSeasonOpen}
          isAddSeasonOpen={isAddSeasonOpen}
          onAddSeasonOpenChange={setIsAddSeasonOpen}
          isDeleteSeasonOpen={isDeleteSeasonOpen}
          onDeleteSeasonOpenChange={setIsDeleteSeasonOpen}
          isDeleteSeasonPending={deleteSeasonMutation.isPending}
          onConfirmDeleteSeason={() => {
            if (series.seasons && series.seasons.length <= 1) return;
            if (activeSeason) {
              deleteSeasonMutation.mutate(activeSeason.id);
            }
          }}
          isEditDialogOpen={isEditDialogOpen}
          onEditDialogOpenChange={setIsEditDialogOpen}
          isManageSourcesOpen={isManageSourcesOpen}
          onManageSourcesOpenChange={setIsManageSourcesOpen}
          manageSourcesInitialTab={manageSourcesInitialTab}
          onManageSourcesInitialTabChange={setManageSourcesInitialTab}
          isDeleteDialogOpen={isDeleteDialogOpen}
          onDeleteDialogOpenChange={setIsDeleteDialogOpen}
          onConfirmDeleteEpisode={handleConfirmDelete}
        />
      </DragDropContext>
    </div>
  );
}
