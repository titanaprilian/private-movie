export { stripSeasonDescriptors } from "./title";
export { parseBulkScrapedEpisodeNumber } from "./episode-number";
export {
  applySequentialFallback,
  type SequentialFallbackItem,
  type SequentialFallbackTarget,
} from "./sequential-fallback";
export {
  createBulkServiceInternal,
  type BulkServiceInternal,
  type BulkServiceOptions,
  type PreviewBulkSourcesInput,
  type PreviewBulkSourcesResult,
  type ScrapedBulkEpisodeItem,
  type BulkPreviewLocalEpisodeItem,
  type BulkSourceItem,
  type BulkSourceItemVideoSource,
  type SaveBulkSourcesInput,
  type SaveBulkSourcesResult,
  type PreviewScrapeSeriesFn,
  type VideoSource as BulkVideoSource,
} from "./service";
