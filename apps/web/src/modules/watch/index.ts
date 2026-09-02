export * from './internal/WatchOption1';
export * from './internal/WatchOption2';
export * from './internal/WatchOption3';
export { SeriesWatchView } from './internal/SeriesWatchView';
export type { SeriesWatchViewProps } from './internal/SeriesWatchView';

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

