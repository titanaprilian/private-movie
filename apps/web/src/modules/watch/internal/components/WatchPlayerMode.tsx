import { WatchTopNav } from './WatchTopNav';
import { WatchPlayerFrame } from './WatchPlayerFrame';
import { WatchToolbar } from './WatchToolbar';
import { ActiveEpisodeCard } from './ActiveEpisodeCard';
import { EpisodeExplorer } from './EpisodeExplorer';
import type { WatchPlayerModeProps } from '../types';

/** Player mode: sticky top nav, player frame, toolbar, and episode list. */
export function WatchPlayerMode({
  series,
  onBackToOverview,
  isBackFocused,
  isSpatialMode,
  backRef,
  activeSource,
  episodeThumbnailUrl,
  episodeTitle,
  isPlayerFocused,
  iframeRef,
  hasNextEpisode,
  hasPrevEpisode,
  onPrevEpisode,
  onNextEpisode,
  onReloadPlayer,
  onOpenNewTab,
  isEmbedSource,
  activeSourceIndex,
  sources,
  onSelectSource,
  controlsRefs,
  serverControlIndex,
  activeZone,
  focusIndex,
  activeEpisode,
  activeSeasonTitle,
  formattedDuration,
  seasons,
  activeSeasonId,
  onSelectSeason,
  episodes,
  activeEpisodeId,
  onSelectEpisode,
  episodeRefs,
}: WatchPlayerModeProps) {
  return (
    <div>
      {/* Hoisted sticky top navigation (shell-level, stays pinned on scroll) */}
      <WatchTopNav
        mode="player"
        onBackToOverview={onBackToOverview}
        isBackFocused={isBackFocused}
        isSpatialMode={isSpatialMode}
        backRef={backRef}
      />
      <div className="px-4 sm:px-8 md:px-12 lg:px-16 py-4 lg:py-6 space-y-6">
        {/* Video Player Container: viewport-height constrained so TopNav,
            player and toolbar fit short laptop viewports without scrolling */}
        <WatchPlayerFrame
          activeSource={activeSource}
          episodeThumbnailUrl={episodeThumbnailUrl}
          episodeTitle={episodeTitle}
          seriesBackdropUrl={series.backdropUrl}
          isPlayerFocused={isPlayerFocused}
          iframeRef={iframeRef}
          hasNextEpisode={hasNextEpisode}
          onNextEpisode={onNextEpisode}
        />
        {/* Docked Player Toolbar — Semantic Grouping & Single-Row Flex Flow */}
        <WatchToolbar
          hasPrevEpisode={hasPrevEpisode}
          hasNextEpisode={hasNextEpisode}
          onPrevEpisode={onPrevEpisode}
          onNextEpisode={onNextEpisode}
          onReloadPlayer={onReloadPlayer}
          onOpenNewTab={onOpenNewTab}
          isEmbedSource={isEmbedSource}
          activeSourceIndex={activeSourceIndex}
          sources={sources}
          onSelectSource={onSelectSource}
          controlsRefs={controlsRefs}
          serverControlIndex={serverControlIndex}
          isSpatialMode={isSpatialMode}
          activeZone={activeZone}
          focusIndex={focusIndex}
        />
        {/* Active Episode Overview Details (Chunky meta-card) */}
        {activeEpisode && (
          <ActiveEpisodeCard
            seriesTitle={series.title}
            activeEpisode={activeEpisode}
            activeSeasonTitle={activeSeasonTitle}
            formattedDuration={formattedDuration}
            onBackToOverview={onBackToOverview}
          />
        )}
        {/* Episode Explorer vertical list below active episode in Player Mode */}
        <EpisodeExplorer
          seasons={seasons}
          activeSeasonId={activeSeasonId}
          onSelectSeason={onSelectSeason}
          episodes={episodes}
          series={series}
          activeEpisodeId={activeEpisodeId}
          onSelectEpisode={onSelectEpisode}
          episodeRefs={episodeRefs}
          isSpatialMode={isSpatialMode}
          activeZone={activeZone}
          focusIndex={focusIndex}
          layoutMode="list"
        />
      </div>
    </div>
  );
}
