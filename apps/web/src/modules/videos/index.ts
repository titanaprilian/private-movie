export { VideoList } from './internal/VideoList';
export { SeriesDetailView } from './internal/SeriesDetailView';
export { AddMediaDialog } from './internal/AddMediaDialog';
export {
  fetchEpisodes,
  episodesQueryOptions,
  fetchSeriesDetail,
  seriesDetailQueryOptions,
  previewScrape,
  saveMedia,
} from './internal/api';
export type { SeriesDetailViewProps } from './internal/SeriesDetailView';
export type {
  Episode,
  Episode as ApiEpisode,
  FetchEpisodesParams,
  EpisodesListResponse,
  SeriesDetails,
  SeriesDetails as Series,
  PreviewScrapeParams,
  PreviewScrapeResult,
  SaveMediaParams,
  SaveMediaResult,
} from './internal/api';
