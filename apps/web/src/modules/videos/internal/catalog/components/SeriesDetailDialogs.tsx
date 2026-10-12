import type { SeriesDetailDialogsProps } from '../types';
export type { ManageSourcesInitialTab, SeriesDetailDialogsProps, UpdateEpisodeMutation } from '../types';
import { EditSeasonDialog } from '../../seasons/EditSeasonDialog';
import { AddSeasonDialog } from '../../seasons/AddSeasonDialog';
import { EditSeriesDialog } from './EditSeriesDialog';
import { EditEpisodeDialog } from './EditEpisodeDialog';
import { SyncTmdbModal } from '../../ingestion/SyncTmdbModal';
import { ManageSourcesDialog } from '../../sources/ManageSourcesDialog';
import { MoveEpisodesDialog } from '../../seasons/MoveEpisodesDialog';
import { BulkScrapeModal } from '../../ingestion/BulkScrapeModal';
import { BulkIngestModal } from '../../ingestion/BulkIngestModal';
import { BatchDeleteDialog } from '../../seasons/BatchDeleteDialog';
import { ChunkyConfirmDialog } from '@/components/ui/chunky-confirm-dialog';

export function SeriesDetailDialogs({
  series,
  seriesId,
  seasons,
  activeSeason,
  localEpisodes,
  selectedEpisode,
  selectedEpisodeIds,
  episodeCountBySeason,
  updateMutation,
  modals,
  onConfirmBulkMove,
  isMovePending,
  onConfirmBatchDelete,
  isBatchOperating,
  isDeleteSeasonPending,
  onConfirmDeleteSeason,
  onConfirmDeleteEpisode,
}: SeriesDetailDialogsProps) {
  return (
    <>
      <MoveEpisodesDialog
        open={modals.isMoveEpisodesOpen}
        onOpenChange={modals.onMoveEpisodesOpenChange}
        seasons={seasons ?? []}
        currentSeasonId={activeSeason?.id ?? null}
        selectedCount={selectedEpisodeIds.length}
        episodeCountBySeason={episodeCountBySeason}
        isPending={isMovePending}
        onConfirm={onConfirmBulkMove}
      />
      <BatchDeleteDialog
        open={modals.isBatchDeleteOpen}
        onOpenChange={modals.onBatchDeleteOpenChange}
        selectedEpisodeCount={selectedEpisodeIds.length}
        onConfirmDelete={onConfirmBatchDelete}
        isPending={isBatchOperating}
      />
      <EditSeriesDialog
        open={modals.isEditSeriesOpen}
        onOpenChange={modals.onEditSeriesOpenChange}
        series={series}
      />
      <SyncTmdbModal
        open={modals.isSyncTmdbOpen}
        onOpenChange={modals.onSyncTmdbOpenChange}
        series={series}
      />
      <BulkScrapeModal
        open={modals.isBulkScrapeOpen}
        onOpenChange={(open) => {
          modals.onBulkScrapeOpenChange(open);
          if (!open) modals.onBulkScrapeEpisodeIdsChange(null);
        }}
        seriesId={seriesId}
        localEpisodes={
          modals.bulkScrapeEpisodeIds
            ? localEpisodes.filter((ep) => modals.bulkScrapeEpisodeIds!.includes(ep.id))
            : localEpisodes
        }
        seasons={seasons ?? []}
      />
      <BulkIngestModal
        open={modals.isBulkIngestOpen}
        onOpenChange={modals.onBulkIngestOpenChange}
        seriesId={seriesId}
        localEpisodes={localEpisodes}
        seasons={seasons ?? []}
      />
      {activeSeason && (
        <EditSeasonDialog
          season={activeSeason}
          open={modals.isEditSeasonOpen}
          onOpenChange={modals.onEditSeasonOpenChange}
        />
      )}
      <AddSeasonDialog
        open={modals.isAddSeasonOpen}
        onOpenChange={modals.onAddSeasonOpenChange}
        seriesId={seriesId}
        seasons={seasons ?? []}
      />

      {/* Delete Season Confirmation Dialog */}
      <ChunkyConfirmDialog
        open={modals.isDeleteSeasonOpen}
        onOpenChange={modals.onDeleteSeasonOpenChange}
        title="Delete Season"
        description={`Are you sure you want to delete ${activeSeason?.title ? `"${activeSeason.title}"` : 'this season'}? Seasons containing episodes cannot be deleted. This action cannot be undone.`}
        confirmLabel={isDeleteSeasonPending ? 'Deleting...' : 'Delete'}
        cancelLabel="Cancel"
        confirmVariant="danger"
        isPending={isDeleteSeasonPending}
        onConfirm={onConfirmDeleteSeason}
        confirmButtonTestId="confirm-delete-season"
      />

      {/* Edit Episode Dialog */}
      <EditEpisodeDialog
        open={modals.isEditDialogOpen}
        onOpenChange={modals.onEditDialogOpenChange}
        episode={selectedEpisode}
        updateMutation={updateMutation}
      />

      {/* Manage Sources Dialog */}
      <ManageSourcesDialog
        open={modals.isManageSourcesOpen}
        onOpenChange={(open) => {
          modals.onManageSourcesOpenChange(open);
          if (!open) modals.onManageSourcesInitialTabChange(undefined);
        }}
        episode={selectedEpisode}
        seriesId={seriesId}
        initialTab={modals.manageSourcesInitialTab}
      />

      {/* Delete Episode Confirmation Dialog */}
      <ChunkyConfirmDialog
        open={modals.isDeleteDialogOpen}
        onOpenChange={modals.onDeleteDialogOpenChange}
        title="Delete Episode"
        description={`Are you sure you want to delete ${selectedEpisode?.title ? `"${selectedEpisode.title}"` : 'this episode'}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={onConfirmDeleteEpisode}
        confirmButtonTestId="confirm-delete-episode"
      />
    </>
  );
}
