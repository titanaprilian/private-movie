import type { SyncSnapshotCardProps } from '../../types';
export type { SyncSnapshotCardProps } from '../../types';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { MetaBadge } from '../IngestionBadges';

export function SyncSnapshotCard({
  previewData,
  seriesType,
  tmdbId,
}: SyncSnapshotCardProps) {
  return (
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
            {seriesType === 'movie' && typeof previewData.runtime === 'number' && (
              <MetaBadge>{previewData.runtime} mins</MetaBadge>
            )}
            {seriesType === 'tv' && (
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
  );
}
