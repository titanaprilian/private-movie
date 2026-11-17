export { stripSeasonDescriptors } from "./title";
export { parseBulkScrapedEpisodeNumber } from "./episode-number";
export {
  applySequentialFallback,
  type SequentialFallbackItem,
  type SequentialFallbackTarget,
} from "./sequential-fallback";
export {
  createBulkServiceInternal,
  type PreviewBulkSourcesInput,
  type PreviewBulkSourcesResult,
  type ScrapedBulkEpisodeItem,
  type BulkPreviewLocalEpisodeItem,
  type BulkSourceItem,
  type BulkSourceItemVideoSource,
  type SaveBulkSourcesInput,
  type SaveBulkSourcesResult,
} from "./service";
