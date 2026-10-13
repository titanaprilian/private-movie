export { SeriesWatchView, WatchViewSkeleton, WatchViewErrorState } from './internal/SeriesWatchView';
export type { SeriesWatchViewProps, WatchViewErrorStateProps } from './internal/types';

export {
  fetchSeriesWithEpisodes,
  getSeriesWithEpisodesQueryOptions,
} from './internal/api';
export type {
  WatchVideoSource,
  WatchEpisode,
  WatchSeason,
  WatchSeriesDetails,
} from './internal/types';
export {
  SeriesHeroBanner,
  WATCH_HERO_MOBILE_GENRE_CAP,
  WatchTopNav,
  EpisodeExplorer,
  EpisodeCard,
  EpisodeRow,
} from './internal/components';
export type {
  SeriesHeroBannerProps,
  WatchTopNavMode,
  WatchTopNavProps,
  EpisodeExplorerProps,
  EpisodeCardProps,
  EpisodeRowProps,
} from './internal/types';
export { useWatchState, resolveDefaultSourceIndex, useWatchNav, useAdblockDetector } from './internal/hooks';
export type {
  UseWatchStateOptions,
  UseWatchStateReturn,
  UseWatchNavOptions,
  UseWatchNavReturn,
  WatchZone,
  AdblockDetectorResult,
} from './internal/types';
export { formatDuration, isInternalReferrer, navigateBackToCatalog } from './internal/utils';
