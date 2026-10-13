import { useSyncTmdb } from './hooks/useSyncTmdb';
import type { SyncTmdbModalProps } from '../types';
import { ChunkySpinner } from '@/components/ui/chunky-spinner';
import { ErrorBanner } from '../../catalog/components/ErrorBanner';

export type { SyncTmdbModalProps } from '../types';
import { SyncSnapshotCard } from './components/SyncSnapshotCard';
import { SyncSeasonDiffList } from './components/SyncSeasonDiffList';
import { SyncEpisodeChangesList } from './components/SyncEpisodeChangesList';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';

export function SyncTmdbModal({ open: openProp, isOpen: isOpenProp, onOpenChange, onClose, series }: SyncTmdbModalProps) {
  const isModalOpen = openProp ?? isOpenProp ?? false;
  const handleOpenChange = (openState: boolean) => {
    if (onOpenChange) onOpenChange(openState);
    if (!openState && onClose) onClose();
  };
  const { seriesType, tmdbId, includeSpecials, setIncludeSpecials, tmdbPreviewData, syncPreviewData,
    isLoadingPreview, previewError, seasonDiffs, totalNewEpisodes, totalNewSeasons, syncMutation } =
    useSyncTmdb({ series, isModalOpen, onSuccess: () => handleOpenChange(false) });
  return (
    <ChunkyDialog open={isModalOpen} onOpenChange={handleOpenChange}>
      <ChunkyDialogContent className="max-w-2xl"
        onPointerDownOutside={(e) => { if (syncMutation.isPending) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (syncMutation.isPending) e.preventDefault(); }}>
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>Sync with TMDB</ChunkyDialogTitle>
          <ChunkyDialogDescription>Preview and sync latest episodes, seasons, and metadata from TMDB.</ChunkyDialogDescription>
        </ChunkyDialogHeader>
        <ChunkyDialogBody className="space-y-4">
          {isLoadingPreview && (
            <div className="flex items-center justify-center py-12 font-sans text-xs font-bold text-[var(--muted)] gap-2">
              <ChunkySpinner size="sm" />
              <span>Fetching TMDB snapshot...</span>
            </div>
          )}
          {previewError && (
            <ErrorBanner message={previewError} />
          )}
          {!isLoadingPreview && tmdbPreviewData && (
            <>
              <SyncSnapshotCard previewData={tmdbPreviewData} seriesType={seriesType} tmdbId={tmdbId} />
              {seriesType === 'tv' && (
                <div className="flex items-center gap-2 py-1">
                  <ChunkyCheckbox id="sync-include-specials" checked={includeSpecials}
                    onCheckedChange={(checked) => setIncludeSpecials(Boolean(checked))}
                    disabled={syncMutation.isPending || isLoadingPreview} />
                  <label htmlFor="sync-include-specials" className="text-sm font-bold text-[var(--muted)] select-none cursor-pointer">
                    Include Specials (Season 0)
                  </label>
                </div>
              )}
              <SyncSeasonDiffList seriesType={seriesType} seasonDiffs={seasonDiffs}
                totalNewEpisodes={totalNewEpisodes} totalNewSeasons={totalNewSeasons}
                totalUpdatedEpisodes={syncPreviewData?.totalUpdatedEpisodes} />
              <SyncEpisodeChangesList episodeChanges={syncPreviewData?.episodeChanges} />
            </>
          )}
        </ChunkyDialogBody>
        <ChunkyDialogFooter>
          <ChunkyButton type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={syncMutation.isPending}>
            Cancel
          </ChunkyButton>
          <ChunkyButton type="button" variant="primary" onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || isLoadingPreview || !tmdbId || !tmdbPreviewData}>
            {syncMutation.isPending && (
              <ChunkySpinner size="xs" className="w-3.5 h-3.5" />
            )}
            {syncMutation.isPending ? 'Syncing...' : 'Confirm & Sync'}
          </ChunkyButton>
        </ChunkyDialogFooter>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
