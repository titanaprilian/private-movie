import type { SyncEpisodeChangesListProps } from '../../types';
export type { SyncEpisodeChangesListProps } from '../../types';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { FieldBadge, MetaBadge } from '../../components/IngestionBadges';

export function SyncEpisodeChangesList({
  episodeChanges,
}: SyncEpisodeChangesListProps) {
  if (!episodeChanges || episodeChanges.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
          Episode Metadata Updates ({episodeChanges.length})
        </span>
      </div>
      <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1">
        {episodeChanges.map((change) => (
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
  );
}
