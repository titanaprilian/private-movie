import type { SeriesWatchViewProps } from './types';
import { useSeriesWatchView } from './hooks';
import {
  WatchViewSkeleton,
  WatchViewErrorState,
  WatchOverviewMode,
  WatchPlayerMode,
  AdblockWarningDialog,
} from './components';

export type { SeriesWatchViewProps };
export { WatchViewSkeleton, WatchViewErrorState };

/** Thin composition root: consumes the coordinator hook, renders modes. */
export function SeriesWatchView(props: SeriesWatchViewProps) {
  const view = useSeriesWatchView(props);
  const { series, seriesId } = { series: view.series, seriesId: props.seriesId };
  const { isLoading, isError, error, refetch, selectedEpisodeId } = view;

  if (isLoading && !series) return <WatchViewSkeleton />;
  if (isError && !series) {
    return (
      <WatchViewErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    );
  }
  if (!series) {
    return (
      <WatchViewErrorState
        message="Series details not found"
        onRetry={seriesId ? () => refetch() : undefined}
      />
    );
  }

  return (
    <div
      className="dark min-h-screen bg-[var(--bg)] text-fg font-sans pb-16"
      data-testid="watch-view"
      style={{ colorScheme: 'dark' }}
    >
      {!selectedEpisodeId ? (
        <WatchOverviewMode
          series={series}
          onBackToCatalog={view.handleBackToHome}
          isBackFocused={view.backFocused}
          isSpatialMode={view.isSpatialMode}
          backRef={view.backRef as unknown as React.Ref<HTMLButtonElement>}
          onPlay={view.handlePlayFirstEpisode}
          isPlayDisabled={!view.firstPlayableEpisode}
          isPlayFocused={
            view.isSpatialMode &&
            view.activeZone === 'controls' &&
            view.focusIndex === 0
          }
          playRef={view.playRef}
          seasons={view.seasons}
          activeSeasonId={view.activeSeasonId}
          onSelectSeason={view.selectSeason}
          episodes={view.availableEpisodes}
          onSelectEpisode={view.handleSelectEpisode}
          episodeRefs={view.episodeRefs}
          activeZone={view.activeZone}
          focusIndex={view.focusIndex}
        />
      ) : (
        <WatchPlayerMode
          series={series}
          onBackToOverview={view.handleBackToOverview}
          isBackFocused={view.backFocused}
          isSpatialMode={view.isSpatialMode}
          backRef={view.backRef as unknown as React.Ref<HTMLButtonElement>}
          activeSource={view.activeSource}
          episodeThumbnailUrl={view.activeEpisode?.thumbnailUrl}
          episodeTitle={view.activeEpisode?.title}
          isPlayerFocused={view.playerFocused}
          iframeRef={view.iframeRef}
          hasNextEpisode={view.hasNextEpisode}
          hasPrevEpisode={view.hasPrevEpisode}
          onPrevEpisode={view.handleGoToPrevEpisode}
          onNextEpisode={view.handleGoToNextEpisode}
          onReloadPlayer={view.handleReloadIframe}
          onOpenNewTab={view.handleOpenNewTab}
          isEmbedSource={view.isEmbedSource}
          activeSourceIndex={view.activeSourceIndex}
          sources={view.sources}
          onSelectSource={view.selectSource}
          controlsRefs={view.controlsRefs}
          serverControlIndex={view.serverControlIndex}
          activeZone={view.activeZone}
          focusIndex={view.focusIndex}
          activeEpisode={view.activeEpisode}
          activeSeasonTitle={view.activeSeason?.title}
          formattedDuration={view.formattedEpisodeDuration}
          seasons={view.seasons}
          activeSeasonId={view.activeSeasonId}
          onSelectSeason={view.selectSeason}
          episodes={view.availableEpisodes}
          activeEpisodeId={selectedEpisodeId}
          onSelectEpisode={view.handleSelectEpisode}
          episodeRefs={view.episodeRefs}
        />
      )}
      <AdblockWarningDialog
        open={view.showAdblockModal}
        onDismiss={view.handleDismissWarning}
      />
    </div>
  );
}
