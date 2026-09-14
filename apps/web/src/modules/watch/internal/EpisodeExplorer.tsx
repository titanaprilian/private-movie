import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EpisodeCard } from './EpisodeCard';
import type { WatchEpisode, WatchSeason, WatchSeriesDetails } from './api';

export interface EpisodeExplorerProps {
  seasons: WatchSeason[];
  activeSeasonId: string | null;
  onSelectSeason: (seasonId: string) => void;
  episodes: WatchEpisode[];
  series?: WatchSeriesDetails | null;
  activeEpisodeId?: string | null;
  onSelectEpisode: (episodeId: string) => void;
  episodeRefs?: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  isSpatialMode?: boolean;
  activeZone?: string;
  focusIndex?: number;
}

export function EpisodeExplorer({
  seasons,
  activeSeasonId,
  onSelectSeason,
  episodes,
  series,
  activeEpisodeId,
  onSelectEpisode,
  episodeRefs,
  isSpatialMode,
  activeZone,
  focusIndex,
}: EpisodeExplorerProps) {
  const seasonCount = seasons.length;

  const renderSeasonSwitcher = () => {
    if (seasonCount <= 1) {
      return null;
    }

    if (seasonCount >= 2 && seasonCount <= 4) {
      return (
        <Tabs
          value={activeSeasonId ?? seasons[0]?.id}
          onValueChange={onSelectSeason}
          className="w-full sm:w-auto"
        >
          <TabsList className="flex flex-wrap h-auto gap-1 bg-card/60 p-1 border border-c rounded-md">
            {seasons.map((season) => (
              <TabsTrigger
                key={season.id}
                value={season.id}
                className="px-3 py-1.5 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-fg"
              >
                {season.title}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      );
    }

    // seasonCount > 4: Radix UI Select dropdown
    return (
      <div className="w-full sm:w-64">
        <Select
          value={activeSeasonId ?? seasons[0]?.id}
          onValueChange={onSelectSeason}
        >
          <SelectTrigger aria-label="Season selector" className="w-full bg-card border-c">
            <SelectValue placeholder="Select Season" />
          </SelectTrigger>
          <SelectContent>
            {seasons.map((season) => (
              <SelectItem key={season.id} value={season.id}>
                {season.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <section className="space-y-4" data-testid="episode-explorer">
      {/* Section Header & Season Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-c pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-semibold tracking-tight text-fg">
            Episodes
          </h3>
          <span className="mono text-xs text-muted px-2 py-0.5 rounded bg-card border border-c">
            {episodes.length} {episodes.length === 1 ? 'Episode' : 'Episodes'}
          </span>
        </div>

        {renderSeasonSwitcher()}
      </div>

      {/* Responsive Episode Card Grid */}
      {episodes.length > 0 ? (
        <div
          data-testid="episode-grid"
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          {episodes.map((episode, idx) => {
            const isNowPlaying = episode.id === activeEpisodeId;
            const isFocused =
              isSpatialMode &&
              activeZone === 'episodes' &&
              focusIndex === idx;

            return (
              <div
                key={episode.id}
                ref={(el) => {
                  if (episodeRefs && episodeRefs.current) {
                    episodeRefs.current[idx] = el?.querySelector('button') ?? null;
                  }
                }}
              >
                <EpisodeCard
                  episode={episode}
                  series={series}
                  onSelect={onSelectEpisode}
                  isNowPlaying={isNowPlaying}
                  isFocused={isFocused}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-36 items-center justify-center rounded-md border border-dashed border-c bg-card/40 p-6 text-center text-muted text-sm">
          No episodes available for this season.
        </div>
      )}
    </section>
  );
}
