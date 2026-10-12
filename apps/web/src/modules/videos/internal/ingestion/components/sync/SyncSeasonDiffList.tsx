import type { SyncSeasonDiffListProps } from '../../types';
export type { SyncSeasonDiffListProps } from '../../types';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { CountBadge, MetaBadge } from '../IngestionBadges';

export function SyncSeasonDiffList({
  seriesType,
  seasonDiffs,
  totalNewEpisodes,
  totalNewSeasons,
  totalUpdatedEpisodes,
}: SyncSeasonDiffListProps) {
  return (
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
          {typeof totalUpdatedEpisodes === 'number' && totalUpdatedEpisodes > 0 && (
            <CountBadge tone="amber">
              {totalUpdatedEpisodes} updated {totalUpdatedEpisodes === 1 ? 'episode' : 'episodes'}
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
  );
}
