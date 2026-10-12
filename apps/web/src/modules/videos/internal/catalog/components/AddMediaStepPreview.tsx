import type { AddMediaStepPreviewProps } from '../types';
export type { AddMediaStepPreviewProps } from '../types';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { ErrorBanner } from './AddMediaStepInput';

function MetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-xs font-extrabold border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">
      {children}
    </span>
  );
}

export function AddMediaStepPreview({
  tmdbType,
  tmdbId,
  previewData,
  importError,
}: AddMediaStepPreviewProps) {
  return (
    <div className="space-y-4">
      {previewData && (
        <>
          <ChunkyCard className="p-4 space-y-3">
            <div className="flex items-center justify-between border-b-2 border-[var(--border)] pb-2">
              <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                TMDB Snapshot Overview
              </span>
              <MetaBadge>
                {tmdbType} • ID #{tmdbId}
              </MetaBadge>
            </div>

            <div className="flex gap-4">
              {previewData.posterUrl && (
                <img
                  src={previewData.posterUrl}
                  alt={previewData.title}
                  className="w-20 h-28 object-cover rounded-2xl border-2 border-[var(--border)] shrink-0"
                />
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <h3 className="font-display text-xl font-bold text-[var(--ink)]">
                  {previewData.title}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  {previewData.releaseDate && (
                    <MetaBadge>{previewData.releaseDate}</MetaBadge>
                  )}
                  {tmdbType === 'movie' && typeof previewData.runtime === 'number' && (
                    <MetaBadge>{previewData.runtime} mins</MetaBadge>
                  )}
                  {tmdbType === 'tv' && (
                    <>
                      {previewData.status && (
                        <MetaBadge>{previewData.status}</MetaBadge>
                      )}
                      {typeof previewData.totalSeasons === 'number' && (
                        <MetaBadge>
                          {previewData.totalSeasons} Seasons
                        </MetaBadge>
                      )}
                      {typeof previewData.totalEpisodes === 'number' && (
                        <MetaBadge>
                          {previewData.totalEpisodes} Episodes
                        </MetaBadge>
                      )}
                    </>
                  )}
                </div>
                {previewData.genres && previewData.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {previewData.genres.map((genre) => (
                      <MetaBadge key={genre}>{genre}</MetaBadge>
                    ))}
                  </div>
                )}
                <p className="text-sm font-semibold text-[var(--muted)] leading-relaxed line-clamp-3">
                  {previewData.overview || 'No overview available.'}
                </p>
              </div>
            </div>
          </ChunkyCard>

          {tmdbType === 'tv' && previewData.seasons && previewData.seasons.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                  Season Breakdown
                </span>
                <span className="text-sm font-bold text-[var(--muted)]">
                  {previewData.totalSeasons ?? previewData.seasons.length} Seasons • {previewData.totalEpisodes ?? 0} Episodes
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {previewData.seasons.map((season) => (
                  <ChunkyCard
                    key={season.seasonNumber}
                    className="flex items-center justify-between p-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-[13px] font-extrabold text-[var(--muted)]">
                        S{season.seasonNumber}
                      </span>
                      <span className="font-bold text-[var(--ink)]">{season.name}</span>
                    </div>
                    <MetaBadge>
                      {season.episodeCount} {season.episodeCount === 1 ? 'ep' : 'eps'}
                    </MetaBadge>
                  </ChunkyCard>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {importError && (
        <ErrorBanner
          message={
            importError instanceof Error
              ? importError.message
              : 'Failed to import TMDB series'
          }
        />
      )}
    </div>
  );
}
