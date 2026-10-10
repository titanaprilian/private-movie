import { BackButton } from '@/components/ui/back-button';
import { ChunkyChip } from '@/components/ui/chunky-chip';
import type { StorageSeriesItem } from '../api';
import type { StorageResource } from '../api';

export interface StorageSeriesDrilldownProps {
  series: StorageSeriesItem;
  seasons: StorageSeriesItem['seasons'];
  activeSeasonId: string | null;
  onSelectSeason: (seasonId: string | null) => void;
  onBack: () => void;
  resources: StorageResource[];
  isLoading: boolean;
  renderTable: (scopedResources: StorageResource[]) => React.ReactNode;
}

export function StorageSeriesDrilldown({
  series,
  seasons,
  activeSeasonId,
  onSelectSeason,
  onBack,
  resources,
  isLoading,
  renderTable,
}: StorageSeriesDrilldownProps) {
  const scoped = activeSeasonId
    ? resources.filter((r) => r.episode?.seasonId === activeSeasonId)
    : resources;

  return (
    <div className="space-y-4" data-testid="series-drilldown-view">
      <BackButton
        onClick={onBack}
        label="Back to series"
        data-testid="back-to-series-btn"
      />

      <div className="min-w-0">
        <h2
          className="font-display font-extrabold text-xl text-[var(--ink)] truncate"
          data-testid="drilldown-series-title"
        >
          {series.title}
        </h2>
        <p className="font-sans text-xs font-semibold text-[var(--muted)]">
          {series.s3SourceCount} file{series.s3SourceCount === 1 ? '' : 's'} ·{' '}
          {seasons.length} season{seasons.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="season-bar" data-testid="season-chip-bar">
        <span className="lbl">SEASON:</span>
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <ChunkyChip
            variant={activeSeasonId === null ? 'active' : 'default'}
            pressed={activeSeasonId === null}
            onClick={() => onSelectSeason(null)}
            type="button"
            data-testid="season-chip-all"
          >
            All
          </ChunkyChip>
          {seasons.map((season) => {
            const isActive = season.id === activeSeasonId;
            const title = season.title || `Season ${season.seasonNumber}`;
            return (
              <ChunkyChip
                key={season.id}
                variant={isActive ? 'active' : 'default'}
                pressed={isActive}
                onClick={() => onSelectSeason(season.id)}
                type="button"
                data-testid={`season-chip-${season.id}`}
              >
                {title}
              </ChunkyChip>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <p
          className="text-center font-sans text-xs font-bold text-[var(--muted)]"
          data-testid="drilldown-loading"
        >
          Loading series files...
        </p>
      ) : (
        renderTable(scoped)
      )}
    </div>
  );
}
