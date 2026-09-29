import React, { useEffect, useRef } from 'react';
import { ChunkyCard } from '@/components/ui/chunky-card';
import {
  ChunkyTabs,
  ChunkyTabsList,
  ChunkyTabsTrigger,
} from '@/components/ui/chunky-tabs';
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import { EpisodeCard } from './EpisodeCard';
import { EpisodeRow } from './EpisodeRow';
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
  layoutMode?: 'grid' | 'list';
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
  layoutMode = 'grid',
}: EpisodeExplorerProps) {
  const seasonCount = seasons.length;
  const activeCardRefMap = useRef<Map<string, HTMLDivElement | null>>(
    new Map()
  );

  // Smoothly scroll the active episode card into view when playback starts
  // or when navigating between episodes. Uses block: 'nearest' to keep the
  // sticky video player anchored without disorienting viewport jumps.
  useEffect(() => {
    if (!activeEpisodeId) return;
    const el = activeCardRefMap.current.get(activeEpisodeId);
    if (el && typeof el.scrollIntoView === 'function') {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {
        // ignore — jsdom or older environments may not support options
      }
    }
  }, [activeEpisodeId, episodes]);

  const renderSeasonSwitcher = () => {
    if (seasonCount <= 1) {
      return null;
    }

    if (seasonCount >= 2 && seasonCount <= 4) {
      return (
        <ChunkyTabs
          value={activeSeasonId ?? seasons[0]?.id}
          onValueChange={onSelectSeason}
          className="w-full sm:w-auto"
        >
          <ChunkyTabsList className="flex flex-wrap h-auto gap-2">
            {seasons.map((season) => (
              <ChunkyTabsTrigger key={season.id} value={season.id}>
                {season.title}
              </ChunkyTabsTrigger>
            ))}
          </ChunkyTabsList>
        </ChunkyTabs>
      );
    }

    // seasonCount > 4: ChunkySelect dropdown
    return (
      <div className="w-full sm:w-64">
        <ChunkySelect
          value={activeSeasonId ?? seasons[0]?.id}
          onValueChange={onSelectSeason}
        >
          <ChunkySelectTrigger aria-label="Season selector" className="w-full">
            <ChunkySelectValue placeholder="Select Season" />
          </ChunkySelectTrigger>
          <ChunkySelectContent>
            {seasons.map((season) => (
              <ChunkySelectItem key={season.id} value={season.id}>
                {season.title}
              </ChunkySelectItem>
            ))}
          </ChunkySelectContent>
        </ChunkySelect>
      </div>
    );
  };

  return (
    <section className="space-y-4" data-testid="episode-explorer">
      {/* Section Header & Season Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b-2 border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-base sm:text-lg font-extrabold tracking-tight text-[var(--ink)]">
            Episodes
          </h3>
          <span className="mono rounded-xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-bold text-[var(--muted)]">
            {episodes.length} {episodes.length === 1 ? 'Episode' : 'Episodes'}
          </span>
        </div>

        {renderSeasonSwitcher()}
      </div>

      {/* Responsive Episode Grid (Overview Mode) or Vertical Episode List (Player Mode) */}
      {episodes.length > 0 ? (
        layoutMode === 'list' ? (
          <div data-testid="episode-list" className="flex flex-col gap-2.5">
            {episodes.map((episode, idx) => {
              const isNowPlaying = episode.id === activeEpisodeId;
              const isFocused =
                isSpatialMode &&
                activeZone === 'episodes' &&
                focusIndex === idx;

              return (
                <div
                  key={episode.id}
                  data-episode-id={episode.id}
                  data-testid={`episode-card-${episode.id}`}
                  ref={(el) => {
                    if (el) {
                      activeCardRefMap.current.set(episode.id, el);
                    } else {
                      activeCardRefMap.current.delete(episode.id);
                    }
                    if (episodeRefs && episodeRefs.current) {
                      episodeRefs.current[idx] =
                        (el?.querySelector(
                          '[role="button"]'
                        ) as HTMLButtonElement | null) ?? null;
                    }
                  }}
                >
                  <EpisodeRow
                    episode={episode}
                    index={idx}
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
                  data-episode-id={episode.id}
                  data-testid={`episode-card-${episode.id}`}
                  ref={(el) => {
                    if (el) {
                      activeCardRefMap.current.set(episode.id, el);
                    } else {
                      activeCardRefMap.current.delete(episode.id);
                    }
                    if (episodeRefs && episodeRefs.current) {
                      episodeRefs.current[idx] =
                        (el?.querySelector(
                          '[role="button"]'
                        ) as HTMLButtonElement | null) ?? null;
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
        )
      ) : (
        <ChunkyCard className="flex h-36 items-center justify-center border-dashed p-6 text-center text-sm font-bold text-[var(--muted)]">
          No episodes available for this season.
        </ChunkyCard>
      )}
    </section>
  );
}
