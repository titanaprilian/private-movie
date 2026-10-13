import { SeriesHeroBanner } from './SeriesHeroBanner';
import { WatchTopNav } from './WatchTopNav';
import { EpisodeExplorer } from './EpisodeExplorer';
import type { WatchOverviewModeProps } from '../types';

/** Series overview mode: sticky top nav, hero banner, and episode explorer. */
export function WatchOverviewMode({
  series,
  onBackToCatalog,
  isBackFocused,
  isSpatialMode,
  backRef,
  onPlay,
  isPlayDisabled,
  isPlayFocused,
  playRef,
  seasons,
  activeSeasonId,
  onSelectSeason,
  episodes,
  onSelectEpisode,
  episodeRefs,
  activeZone,
  focusIndex,
}: WatchOverviewModeProps) {
  return (
    <div>
      {/* Hoisted sticky top navigation (shell-level, stays pinned on scroll) */}
      <WatchTopNav
        mode="overview"
        onBackToCatalog={onBackToCatalog}
        isBackFocused={isBackFocused}
        isSpatialMode={isSpatialMode}
        backRef={backRef}
      />
      {/* Container A: Hero Banner (Full width edge-to-edge) */}
      <SeriesHeroBanner
        series={series}
        onPlay={onPlay}
        isPlayDisabled={isPlayDisabled}
        isSpatialMode={isSpatialMode}
        isPlayFocused={isPlayFocused}
        playRef={playRef}
      />
      {/* Container B: Episode Explorer (Home-aligned padding) */}
      <div className="px-4 sm:px-8 md:px-12 lg:px-16 pt-8">
        <EpisodeExplorer
          seasons={seasons}
          activeSeasonId={activeSeasonId}
          onSelectSeason={onSelectSeason}
          episodes={episodes}
          series={series}
          activeEpisodeId={null}
          onSelectEpisode={onSelectEpisode}
          episodeRefs={episodeRefs}
          isSpatialMode={isSpatialMode}
          activeZone={activeZone}
          focusIndex={focusIndex}
        />
      </div>
    </div>
  );
}
