import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchSeriesTmdbPreview,
  syncSeriesTmdb,
  type SeriesDetails,
  type TmdbPreviewResult,
} from './api';
import { computeSyncDiff } from './computeSyncDiff';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export interface SyncTmdbModalProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  series: SeriesDetails;
}

export function SyncTmdbModal({
  open: openProp,
  isOpen: isOpenProp,
  onOpenChange,
  onClose,
  series,
}: SyncTmdbModalProps) {
  const isModalOpen = openProp ?? isOpenProp ?? false;

  const handleOpenChange = (openState: boolean) => {
    if (onOpenChange) {
      onOpenChange(openState);
    }
    if (!openState && onClose) {
      onClose();
    }
  };

  const queryClient = useQueryClient();

  const [includeSpecials, setIncludeSpecials] = useState(false);
  const [tmdbPreviewData, setTmdbPreviewData] = useState<TmdbPreviewResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const seriesType = series.type ?? 'tv';
  const tmdbId = series.tmdbId;

  useEffect(() => {
    if (!isModalOpen) {
      setIncludeSpecials(false);
      setTmdbPreviewData(null);
      setPreviewError(null);
      return;
    }

    if (!tmdbId) {
      setTmdbPreviewData(null);
      setPreviewError('This series does not have a linked TMDB ID. Please link it in Edit Series first.');
      return;
    }

    let isMounted = true;
    setIsLoadingPreview(true);
    setPreviewError(null);

    fetchSeriesTmdbPreview(seriesType, tmdbId, includeSpecials)
      .then((data) => {
        if (isMounted) {
          setTmdbPreviewData(data);
          setIsLoadingPreview(false);
        }
      })
      .catch((err: Error) => {
        if (isMounted) {
          setPreviewError(err.message || 'Failed to fetch TMDB preview');
          setIsLoadingPreview(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isModalOpen, seriesType, tmdbId, includeSpecials]);

  const { seasonDiffs, totalNewEpisodes, totalNewSeasons } = useMemo(() => {
    return computeSyncDiff(series, tmdbPreviewData);
  }, [series, tmdbPreviewData]);

  const syncMutation = useMutation({
    mutationFn: () => {
      if (!tmdbId) {
        throw new Error('Missing TMDB ID');
      }
      return syncSeriesTmdb(series.id, {
        type: seriesType,
        tmdbId,
        includeSpecials,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', series.id] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      const countText = `+${totalNewEpisodes} new ${totalNewEpisodes === 1 ? 'episode' : 'episodes'}`;
      toast.success(`Series successfully synced with TMDB (${countText})`);
      handleOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error('Failed to sync with TMDB', {
        description: err.message || 'An unknown error occurred during sync',
      });
    },
  });

  return (
    <Dialog open={isModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] flex flex-col"
        onPointerDownOutside={(e) => {
          if (syncMutation.isPending) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (syncMutation.isPending) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Sync with TMDB</DialogTitle>
          <DialogDescription>
            Preview and sync latest episodes, seasons, and metadata from TMDB.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {isLoadingPreview && (
            <div className="flex items-center justify-center py-12 text-muted text-xs mono gap-2">
              <svg
                className="animate-spin w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span>Fetching TMDB snapshot...</span>
            </div>
          )}

          {previewError && (
            <div className="p-3 rounded border border-red-200 dark:border-red-900/50 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs mono flex items-center gap-2">
              <svg
                className="w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="16" />
              </svg>
              <span>{previewError}</span>
            </div>
          )}

          {!isLoadingPreview && tmdbPreviewData && (
            <>
              {/* TMDB Snapshot Overview Card */}
              <div className="bg-card border border-c rounded p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-c pb-2">
                  <span className="text-[10px] mono uppercase tracking-wider font-semibold text-muted">
                    TMDB Snapshot Overview
                  </span>
                  <span className="text-[10px] mono px-2 py-0.5 rounded bg-muted/20 border border-c text-muted uppercase">
                    {seriesType} • ID #{tmdbId}
                  </span>
                </div>

                <div className="flex gap-4">
                  {tmdbPreviewData.posterUrl && (
                    <img
                      src={tmdbPreviewData.posterUrl}
                      alt={tmdbPreviewData.title}
                      className="w-20 h-28 object-cover rounded border border-c shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <h3 className="text-sm font-semibold text-current">
                      {tmdbPreviewData.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {tmdbPreviewData.releaseDate && (
                        <span className="text-[10px] mono px-1.5 py-0.5 rounded border border-c bg-sidebar text-muted">
                          {tmdbPreviewData.releaseDate}
                        </span>
                      )}
                      {seriesType === 'movie' && typeof tmdbPreviewData.runtime === 'number' && (
                        <span className="text-[10px] mono px-1.5 py-0.5 rounded border border-c bg-sidebar text-muted">
                          {tmdbPreviewData.runtime} mins
                        </span>
                      )}
                      {seriesType === 'tv' && (
                        <>
                          {tmdbPreviewData.status && (
                            <span className="text-[10px] mono px-1.5 py-0.5 rounded border border-c bg-sidebar text-muted">
                              {tmdbPreviewData.status}
                            </span>
                          )}
                          {typeof tmdbPreviewData.totalSeasons === 'number' && (
                            <span className="text-[10px] mono px-1.5 py-0.5 rounded border border-c bg-sidebar text-muted">
                              {tmdbPreviewData.totalSeasons} Seasons
                            </span>
                          )}
                          {typeof tmdbPreviewData.totalEpisodes === 'number' && (
                            <span className="text-[10px] mono px-1.5 py-0.5 rounded border border-c bg-sidebar text-muted">
                              {tmdbPreviewData.totalEpisodes} Episodes
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {tmdbPreviewData.genres && tmdbPreviewData.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tmdbPreviewData.genres.map((genre) => (
                          <span
                            key={genre}
                            className="text-[10px] mono px-1.5 py-0.5 rounded border border-c bg-card text-muted"
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted leading-relaxed line-clamp-3">
                      {tmdbPreviewData.overview || 'No overview available.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Include Specials Checkbox (for TV) */}
              {seriesType === 'tv' && (
                <div className="flex items-center space-x-2 py-1">
                  <Checkbox
                    id="sync-include-specials"
                    checked={includeSpecials}
                    onCheckedChange={(checked) => setIncludeSpecials(Boolean(checked))}
                    disabled={syncMutation.isPending || isLoadingPreview}
                  />
                  <Label
                    htmlFor="sync-include-specials"
                    className="text-xs font-normal cursor-pointer select-none"
                  >
                    Include Specials (Season 0)
                  </Label>
                </div>
              )}

              {/* Sync Diff Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] mono uppercase tracking-wider font-semibold text-muted">
                    Sync Diff Summary
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] mono px-2 py-0.5 rounded border border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400 font-medium">
                      +{totalNewEpisodes} new {totalNewEpisodes === 1 ? 'episode' : 'episodes'}
                    </span>
                    {seriesType === 'tv' && (
                      <span className="text-[11px] mono px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400 font-medium">
                        +{totalNewSeasons} new {totalNewSeasons === 1 ? 'season' : 'seasons'}
                      </span>
                    )}
                  </div>
                </div>

                {seriesType === 'tv' && seasonDiffs.length > 0 && (
                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {seasonDiffs.map((diffItem) => (
                      <div
                        key={diffItem.seasonNumber}
                        className="flex items-center justify-between p-2 rounded border border-c bg-card text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="mono text-muted text-[11px] font-medium">
                            S{diffItem.seasonNumber}
                          </span>
                          <span className="font-medium text-fg">{diffItem.name}</span>
                        </div>
                        <span
                          className={`mono text-[10px] px-2 py-0.5 rounded border ${
                            diffItem.badgeType === 'new-eps'
                              ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                              : diffItem.badgeType === 'new-season'
                              ? 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400'
                              : 'border-c bg-sidebar text-muted'
                          }`}
                        >
                          {diffItem.badgeText}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-c">
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={syncMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={
              syncMutation.isPending ||
              isLoadingPreview ||
              !tmdbId ||
              !tmdbPreviewData
            }
          >
            {syncMutation.isPending && (
              <svg
                className="animate-spin w-3.5 h-3.5 mr-1.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            )}
            {syncMutation.isPending ? 'Syncing...' : 'Confirm & Sync'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
