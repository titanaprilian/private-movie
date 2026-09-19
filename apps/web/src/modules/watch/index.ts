export { SeriesWatchView } from './internal/SeriesWatchView';
export type { SeriesWatchViewProps } from './internal/SeriesWatchView';
export { SeriesHeroBanner } from './internal/SeriesHeroBanner';
export type { SeriesHeroBannerProps } from './internal/SeriesHeroBanner';
export { EpisodeExplorer } from './internal/EpisodeExplorer';
export type { EpisodeExplorerProps } from './internal/EpisodeExplorer';
export { EpisodeCard } from './internal/EpisodeCard';
export type { EpisodeCardProps } from './internal/EpisodeCard';
export { formatDuration } from './internal/formatDuration';

export {
  fetchSeriesWithEpisodes,
  getSeriesWithEpisodesQueryOptions,
} from './internal/api';
export type {
  WatchVideoSource,
  WatchEpisode,
  WatchSeason,
  WatchSeriesDetails,
} from './internal/api';

export { useWatchState } from './internal/useWatchState';
export type {
  UseWatchStateOptions,
  UseWatchStateReturn,
} from './internal/useWatchState';

export { useWatchNav } from './internal/useWatchNav';
export type {
  WatchZone,
  UseWatchNavOptions,
  UseWatchNavReturn,
} from './internal/useWatchNav';

export { useAdblockDetector } from './internal/useAdblockDetector';
export type { AdblockDetectorResult } from './internal/useAdblockDetector';
