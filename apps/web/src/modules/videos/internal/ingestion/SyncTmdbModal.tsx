import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchSeriesTmdbPreview,
  fetchSeriesTmdbSyncPreview,
  syncSeriesTmdb,
  type SeriesDetails,
  type TmdbPreviewResult,
  type TmdbSyncPreviewResult,
} from '../api';
import { computeSyncDiff } from './computeSyncDiff';
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
import { ChunkyCard } from '@/components/ui/chunky-card';

export interface SyncTmdbModalProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  series: SeriesDetails;
}

function MetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-xs font-extrabold border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">
      {children}
    </span>
  );
}

function CountBadge({
  children,
  tone = 'green',
}: {
  children: React.ReactNode;
  tone?: 'green' | 'blue' | 'amber';
}) {
  const toneClasses =
    tone === 'green'
      ? 'border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]'
      : tone === 'blue'
        ? 'border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue)]'
        : 'border-[var(--gold-dark)] bg-[var(--gold-tint)] text-[var(--gold)]';
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-extrabold border-2 ${toneClasses}`}
    >
      {children}
    </span>
  );
}

function FieldBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-xs font-extrabold border-2 border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue)]">
      {children}
    </span>
  );
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
  const [syncPreviewData, setSyncPreviewData] = useState<TmdbSyncPreviewResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const seriesType = series.type ?? 'tv';
  const tmdbId = series.tmdbId;

  useEffect(() => {
    if (!isModalOpen) {
      setIncludeSpecials(false);
      setTmdbPreviewData(null);
      setSyncPreviewData(null);
      setPreviewError(null);
      return;
    }

    if (!tmdbId) {
      setTmdbPreviewData(null);
      setSyncPreviewData(null);
      setPreviewError('This series does not have a linked TMDB ID. Please link it in Edit Series first.');
      return;
    }

    let isMounted = true;
    setIsLoadingPreview(true);
    setPreviewError(null);

    // Try detailed sync preview endpoint first, fall back to basic preview endpoint if needed
    fetchSeriesTmdbSyncPreview(series.id, {
      type: seriesType,
      tmdbId,
      includeSpecials,
    })
      .then((syncResult) => {
        if (isMounted) {
          setSyncPreviewData(syncResult);
          setTmdbPreviewData({
            title: syncResult.series?.title || '',
            overview: syncResult.series?.overview || '',
            posterUrl: syncResult.series?.posterUrl || null,
            backdropUrl: syncResult.series?.backdropUrl || null,
            releaseDate: syncResult.series?.releaseDate || null,
            genres: syncResult.series?.genres || [],
            status: syncResult.series?.status || null,
            seasons: (syncResult.seasonDiffs || []).map((s) => ({
              seasonNumber: s.seasonNumber,
              name: s.name,
              episodeCount: s.incomingEpisodeCount,
              posterUrl: null,
            })),
          });
          setIsLoadingPreview(false);
        }
      })
      .catch(() => {
        // Fallback to fetchSeriesTmdbPreview
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
      });

    return () => {
      isMounted = false;
    };
  }, [isModalOpen, series.id, seriesType, tmdbId, includeSpecials]);

  const { seasonDiffs, totalNewEpisodes, totalNewSeasons } = useMemo(() => {
    if (syncPreviewData) {
      return {
        seasonDiffs: syncPreviewData.seasonDiffs || [],
        totalNewEpisodes: syncPreviewData.totalNewEpisodes || 0,
        totalNewSeasons: syncPreviewData.totalNewSeasons || 0,
      };
    }
    const computed = computeSyncDiff(series, tmdbPreviewData);
    return {
      seasonDiffs: computed?.seasonDiffs || [],
      totalNewEpisodes: computed?.totalNewEpisodes || 0,
      totalNewSeasons: computed?.totalNewSeasons || 0,
    };
  }, [series, tmdbPreviewData, syncPreviewData]);

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
    <ChunkyDialog open={isModalOpen} onOpenChange={handleOpenChange}>
      <ChunkyDialogContent
        className="max-w-2xl"
        onPointerDownOutside={(e) => {
          if (syncMutation.isPending) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (syncMutation.isPending) e.preventDefault();
        }}
      >
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>Sync with TMDB</ChunkyDialogTitle>
          <ChunkyDialogDescription>
            Preview and sync latest episodes, seasons, and metadata from TMDB.
          </ChunkyDialogDescription>
        </ChunkyDialogHeader>

        <ChunkyDialogBody className="space-y-4">
          {isLoadingPreview && (
            <div className="flex items-center justify-center py-12 font-sans text-xs font-bold text-[var(--muted)] gap-2">
              <svg
                className="animate-spin w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
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
            <div className="p-3 rounded-2xl border-2 border-[var(--red)] bg-[var(--red)]/10 text-[var(--red)] text-sm font-bold flex items-center gap-2">
              <svg
                className="w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
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
              <ChunkyCard className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b-2 border-[var(--border)] pb-2">
                  <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                    TMDB Snapshot Overview
                  </span>
                  <MetaBadge>
                    {seriesType} • ID #{tmdbId}
                  </MetaBadge>
                </div>

                <div className="flex gap-4">
                  {tmdbPreviewData.posterUrl && (
                    <img
                      src={tmdbPreviewData.posterUrl}
                      alt={tmdbPreviewData.title}
                      className="w-20 h-28 object-cover rounded-2xl border-2 border-[var(--border)] shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <h3 className="font-display text-xl font-bold text-[var(--ink)]">
                      {tmdbPreviewData.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {tmdbPreviewData.releaseDate && (
                        <MetaBadge>{tmdbPreviewData.releaseDate}</MetaBadge>
                      )}
                      {seriesType === 'movie' && typeof tmdbPreviewData.runtime === 'number' && (
                        <MetaBadge>{tmdbPreviewData.runtime} mins</MetaBadge>
                      )}
                      {seriesType === 'tv' && (
                        <>
                          {tmdbPreviewData.status && (
                            <MetaBadge>{tmdbPreviewData.status}</MetaBadge>
                          )}
                          {typeof tmdbPreviewData.totalSeasons === 'number' && (
                            <MetaBadge>
                              {tmdbPreviewData.totalSeasons} Seasons
                            </MetaBadge>
                          )}
                          {typeof tmdbPreviewData.totalEpisodes === 'number' && (
                            <MetaBadge>
                              {tmdbPreviewData.totalEpisodes} Episodes
                            </MetaBadge>
                          )}
                        </>
                      )}
                    </div>
                    {tmdbPreviewData.genres && tmdbPreviewData.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tmdbPreviewData.genres.map((genre) => (
                          <MetaBadge key={genre}>{genre}</MetaBadge>
                        ))}
                      </div>
                    )}
                    <p className="text-sm font-semibold text-[var(--muted)] leading-relaxed line-clamp-3">
                      {tmdbPreviewData.overview || 'No overview available.'}
                    </p>
                  </div>
                </div>
              </ChunkyCard>

              {/* Include Specials Checkbox (for TV) */}
              {seriesType === 'tv' && (
                <div className="flex items-center gap-2 py-1">
                  <ChunkyCheckbox
                    id="sync-include-specials"
                    checked={includeSpecials}
                    onCheckedChange={(checked) => setIncludeSpecials(Boolean(checked))}
                    disabled={syncMutation.isPending || isLoadingPreview}
                  />
                  <label
                    htmlFor="sync-include-specials"
                    className="text-sm font-bold text-[var(--muted)] select-none cursor-pointer"
                  >
                    Include Specials (Season 0)
                  </label>
                </div>
              )}

              {/* Sync Diff Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                    Sync Diff Summary
                  </span>
                  <div className="flex items-center gap-2">
                    <CountBadge tone="green">
                      +{totalNewEpisodes} new {totalNewEpisodes === 1 ? 'episode' : 'episodes'}
                    </CountBadge>
                    {seriesType === 'tv' && (
                      <CountBadge tone="blue">
                        +{totalNewSeasons} new {totalNewSeasons === 1 ? 'season' : 'seasons'}
                      </CountBadge>
                    )}
                    {syncPreviewData && syncPreviewData.totalUpdatedEpisodes > 0 && (
                      <CountBadge tone="amber">
                        {syncPreviewData.totalUpdatedEpisodes} updated {syncPreviewData.totalUpdatedEpisodes === 1 ? 'episode' : 'episodes'}
                      </CountBadge>
                    )}
                  </div>
                </div>

                {seriesType === 'tv' && seasonDiffs.length > 0 && (
                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {seasonDiffs.map((diffItem) => (
                      <ChunkyCard
                        key={diffItem.seasonNumber}
                        className="flex items-center justify-between p-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-sans text-[13px] font-extrabold text-[var(--muted)]">
                            S{diffItem.seasonNumber}
                          </span>
                          <span className="font-bold text-[var(--ink)]">{diffItem.name}</span>
                        </div>
                        {diffItem.badgeType === 'existing' ? (
                          <MetaBadge>{diffItem.badgeText}</MetaBadge>
                        ) : (
                          <CountBadge
                            tone={diffItem.badgeType === 'new-eps' ? 'green' : 'blue'}
                          >
                            {diffItem.badgeText}
                          </CountBadge>
                        )}
                      </ChunkyCard>
                    ))}
                  </div>
                )}
              </div>

              {/* Episode Metadata Updates List */}
              {syncPreviewData?.episodeChanges && syncPreviewData.episodeChanges.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                      Episode Metadata Updates ({syncPreviewData.episodeChanges.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {syncPreviewData.episodeChanges.map((change) => (
                      <ChunkyCard
                        key={`${change.seasonNumber}-${change.episodeNumber}`}
                        className="p-2 text-sm space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-sans font-extrabold text-[13px] text-[var(--muted)]">
                            S{change.seasonNumber}E{change.episodeNumber}
                          </span>
                          <div className="flex gap-1">
                            {change.titleChanged && (
                              <FieldBadge>Title</FieldBadge>
                            )}
                            {change.overviewChanged && (
                              <FieldBadge>Overview</FieldBadge>
                            )}
                            {change.thumbnailChanged && (
                              <FieldBadge>Thumbnail</FieldBadge>
                            )}
                            {change.airDateChanged && (
                              <MetaBadge>Air Date</MetaBadge>
                            )}
                          </div>
                        </div>
                        {change.titleChanged && (
                          <div className="text-[13px] font-semibold text-[var(--muted)]">
                            <span className="line-through">{change.oldTitle}</span> →{' '}
                            <span className="font-bold text-[var(--ink)]">{change.newTitle}</span>
                          </div>
                        )}
                      </ChunkyCard>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </ChunkyDialogBody>

        <ChunkyDialogFooter>
          <ChunkyButton
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={syncMutation.isPending}
          >
            Cancel
          </ChunkyButton>
          <ChunkyButton
            type="button"
            variant="primary"
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
                className="animate-spin w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
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
          </ChunkyButton>
        </ChunkyDialogFooter>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
