import { useState } from 'react';
import type {
  SeriesDetails,
  SeasonDetails,
  UpdateEpisodeData,
} from '../../api';
import type { SeriesDetailEpisode } from '../hooks/useSeriesDetail';
import { EditSeasonDialog } from '../../seasons/EditSeasonDialog';
import { AddSeasonDialog } from '../../seasons/AddSeasonDialog';
import { EditSeriesDialog } from './EditSeriesDialog';
import { SyncTmdbModal } from '../../ingestion/SyncTmdbModal';
import { ManageSourcesDialog } from '../../sources/ManageSourcesDialog';
import { MoveEpisodesDialog } from '../../seasons/MoveEpisodesDialog';
import { BulkScrapeModal } from '../../ingestion/BulkScrapeModal';
import { BulkIngestModal } from '../../ingestion/BulkIngestModal';
import { BatchDeleteDialog } from '../../seasons/BatchDeleteDialog';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import { ChunkyConfirmDialog } from '@/components/ui/chunky-confirm-dialog';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyTextarea } from '@/components/ui/chunky-textarea';
import { ChunkyButton } from '@/components/ui/chunky-button';

export type ManageSourcesInitialTab =
  | 'add-url'
  | 'add-direct'
  | 'remote-ingest'
  | 'upload-s3'
  | 'edit-existing';

export interface UpdateEpisodeMutation {
  isPending: boolean;
  mutate: (variables: { id: string; data: UpdateEpisodeData }) => void;
}

export interface SeriesDetailDialogsProps {
  series: SeriesDetails;
  seriesId: string;
  seasons: SeriesDetails['seasons'];
  activeSeason: SeasonDetails | null;
  localEpisodes: SeriesDetailEpisode[];
  selectedEpisode: SeriesDetailEpisode | null;
  selectedEpisodeIds: string[];
  episodeCountBySeason: Record<string, number>;
  updateMutation: UpdateEpisodeMutation;
  // Move episodes dialog
  isMoveEpisodesOpen: boolean;
  onMoveEpisodesOpenChange: (open: boolean) => void;
  onConfirmBulkMove: (targetSeasonId: string) => void;
  isMovePending: boolean;
  // Batch delete dialog
  isBatchDeleteOpen: boolean;
  onBatchDeleteOpenChange: (open: boolean) => void;
  onConfirmBatchDelete: () => void;
  isBatchOperating: boolean;
  // Edit series dialog
  isEditSeriesOpen: boolean;
  onEditSeriesOpenChange: (open: boolean) => void;
  // Sync TMDB modal
  isSyncTmdbOpen: boolean;
  onSyncTmdbOpenChange: (open: boolean) => void;
  // Bulk scrape modal
  isBulkScrapeOpen: boolean;
  onBulkScrapeOpenChange: (open: boolean) => void;
  bulkScrapeEpisodeIds: string[] | null;
  onBulkScrapeEpisodeIdsChange: (ids: string[] | null) => void;
  // Bulk ingest modal
  isBulkIngestOpen: boolean;
  onBulkIngestOpenChange: (open: boolean) => void;
  // Season dialogs
  isEditSeasonOpen: boolean;
  onEditSeasonOpenChange: (open: boolean) => void;
  isAddSeasonOpen: boolean;
  onAddSeasonOpenChange: (open: boolean) => void;
  isDeleteSeasonOpen: boolean;
  onDeleteSeasonOpenChange: (open: boolean) => void;
  isDeleteSeasonPending: boolean;
  onConfirmDeleteSeason: () => void;
  // Edit episode dialog
  isEditDialogOpen: boolean;
  onEditDialogOpenChange: (open: boolean) => void;
  // Manage sources dialog
  isManageSourcesOpen: boolean;
  onManageSourcesOpenChange: (open: boolean) => void;
  manageSourcesInitialTab: ManageSourcesInitialTab | undefined;
  onManageSourcesInitialTabChange: (tab: ManageSourcesInitialTab | undefined) => void;
  // Delete episode dialog
  isDeleteDialogOpen: boolean;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onConfirmDeleteEpisode: () => void;
}

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
  isMoveEpisodesOpen,
  onMoveEpisodesOpenChange,
  onConfirmBulkMove,
  isMovePending,
  isBatchDeleteOpen,
  onBatchDeleteOpenChange,
  onConfirmBatchDelete,
  isBatchOperating,
  isEditSeriesOpen,
  onEditSeriesOpenChange,
  isSyncTmdbOpen,
  onSyncTmdbOpenChange,
  isBulkScrapeOpen,
  onBulkScrapeOpenChange,
  bulkScrapeEpisodeIds,
  onBulkScrapeEpisodeIdsChange,
  isBulkIngestOpen,
  onBulkIngestOpenChange,
  isEditSeasonOpen,
  onEditSeasonOpenChange,
  isAddSeasonOpen,
  onAddSeasonOpenChange,
  isDeleteSeasonOpen,
  onDeleteSeasonOpenChange,
  isDeleteSeasonPending,
  onConfirmDeleteSeason,
  isEditDialogOpen,
  onEditDialogOpenChange,
  isManageSourcesOpen,
  onManageSourcesOpenChange,
  manageSourcesInitialTab,
  onManageSourcesInitialTabChange,
  isDeleteDialogOpen,
  onDeleteDialogOpenChange,
  onConfirmDeleteEpisode,
}: SeriesDetailDialogsProps) {
  const [editTitle, setEditTitle] = useState('');
  const [editVideoType, setEditVideoType] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const handleConfirmEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEpisode) return;
    updateMutation.mutate({
      id: selectedEpisode.id,
      data: {
        title: editTitle,
        videoType: editVideoType || null,
        description: editDescription || null,
      },
    });
    onEditDialogOpenChange(false);
  };

  return (
    <>
      <MoveEpisodesDialog
        open={isMoveEpisodesOpen}
        onOpenChange={onMoveEpisodesOpenChange}
        seasons={seasons ?? []}
        currentSeasonId={activeSeason?.id ?? null}
        selectedCount={selectedEpisodeIds.length}
        episodeCountBySeason={episodeCountBySeason}
        isPending={isMovePending}
        onConfirm={onConfirmBulkMove}
      />
      <BatchDeleteDialog
        open={isBatchDeleteOpen}
        onOpenChange={onBatchDeleteOpenChange}
        selectedEpisodeCount={selectedEpisodeIds.length}
        onConfirmDelete={onConfirmBatchDelete}
        isPending={isBatchOperating}
      />
      <EditSeriesDialog
        open={isEditSeriesOpen}
        onOpenChange={onEditSeriesOpenChange}
        series={series}
      />
      <SyncTmdbModal
        open={isSyncTmdbOpen}
        onOpenChange={onSyncTmdbOpenChange}
        series={series}
      />
      <BulkScrapeModal
        open={isBulkScrapeOpen}
        onOpenChange={(open) => {
          onBulkScrapeOpenChange(open);
          if (!open) onBulkScrapeEpisodeIdsChange(null);
        }}
        seriesId={seriesId}
        localEpisodes={
          bulkScrapeEpisodeIds
            ? localEpisodes.filter((ep) => bulkScrapeEpisodeIds.includes(ep.id))
            : localEpisodes
        }
        seasons={seasons ?? []}
      />
      <BulkIngestModal
        open={isBulkIngestOpen}
        onOpenChange={onBulkIngestOpenChange}
        seriesId={seriesId}
        localEpisodes={localEpisodes}
        seasons={seasons ?? []}
      />
      {activeSeason && (
        <EditSeasonDialog
          season={activeSeason}
          open={isEditSeasonOpen}
          onOpenChange={onEditSeasonOpenChange}
        />
      )}
      <AddSeasonDialog
        open={isAddSeasonOpen}
        onOpenChange={onAddSeasonOpenChange}
        seriesId={seriesId}
        seasons={seasons ?? []}
      />

      {/* Delete Season Confirmation Dialog */}
      <ChunkyConfirmDialog
        open={isDeleteSeasonOpen}
        onOpenChange={onDeleteSeasonOpenChange}
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
      <ChunkyDialog open={isEditDialogOpen} onOpenChange={onEditDialogOpenChange}>
        <ChunkyDialogContent>
          <ChunkyDialogHeader>
            <ChunkyDialogTitle>Edit Episode</ChunkyDialogTitle>
            <ChunkyDialogDescription>
              Update the details of this episode.
            </ChunkyDialogDescription>
          </ChunkyDialogHeader>
          <ChunkyDialogBody>
          <form onSubmit={handleConfirmEdit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="edit-title"
                className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
              >
                Title
              </label>
              <ChunkyInput
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Episode title"
              />
            </div>
            <div>
              <label
                htmlFor="edit-description"
                className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
              >
                Description
              </label>
              <ChunkyTextarea
                id="edit-description"
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Episode description"
              />
            </div>
            <div>
              <label
                htmlFor="edit-video-type"
                className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
              >
                Video Type
              </label>
              <ChunkyInput
                id="edit-video-type"
                value={editVideoType}
                onChange={(e) => setEditVideoType(e.target.value)}
                placeholder="e.g. mp4, embed"
              />
            </div>
            <ChunkyDialogFooter>
              <ChunkyButton
                type="button"
                variant="outline"
                onClick={() => onEditDialogOpenChange(false)}
              >
                Cancel
              </ChunkyButton>
              <ChunkyButton type="submit" variant="primary">
                Save Changes
              </ChunkyButton>
            </ChunkyDialogFooter>
          </form>
          </ChunkyDialogBody>
        </ChunkyDialogContent>
      </ChunkyDialog>

      {/* Manage Sources Dialog */}
      <ManageSourcesDialog
        open={isManageSourcesOpen}
        onOpenChange={(open) => {
          onManageSourcesOpenChange(open);
          if (!open) onManageSourcesInitialTabChange(undefined);
        }}
        episode={selectedEpisode}
        seriesId={seriesId}
        initialTab={manageSourcesInitialTab}
      />

      {/* Delete Episode Confirmation Dialog */}
      <ChunkyConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={onDeleteDialogOpenChange}
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
