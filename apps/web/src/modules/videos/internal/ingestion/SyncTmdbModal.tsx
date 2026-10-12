import { useSyncTmdb } from './hooks/useSyncTmdb';
import type { SyncTmdbModalProps } from './types';

export type { SyncTmdbModalProps } from './types';
import { SyncSnapshotCard } from './components/sync/SyncSnapshotCard';
import { SyncSeasonDiffList } from './components/sync/SyncSeasonDiffList';
import { SyncEpisodeChangesList } from './components/sync/SyncEpisodeChangesList';
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
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Fetching TMDB snapshot...</span>
            </div>
          )}
          {previewError && (
            <div className="p-3 rounded-2xl border-2 border-[var(--red)] bg-[var(--red)]/10 text-[var(--red)] text-sm font-bold flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="16" />
              </svg>
              <span>{previewError}</span>
            </div>
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
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {syncMutation.isPending ? 'Syncing...' : 'Confirm & Sync'}
          </ChunkyButton>
        </ChunkyDialogFooter>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
