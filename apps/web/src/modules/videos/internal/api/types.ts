import type {
  AdminPaginationMeta,
  AdminVideoSourceItem,
  AdminEpisodeItem,
  AdminSeasonItem,
  AdminSeriesItemSeasonSummary,
  AdminSeriesItem,
  AdminSeriesDetails,
  AdminSeriesListQuery,
  AdminSeriesListResponseData,
  AdminUpdateSeriesRequest,
  AdminUpdateSeasonRequest,
  AdminScrapeOngoingSeasonResponseData,
  AdminEpisodesListQuery,
  AdminEpisodesListResponseData,
  AdminUpdateEpisodeRequest,
  AdminReorderEpisodesRequestItem,
  AdminVideoSourceInput,
  AdminAddVideoSourcesRequest,
  AdminUpdateVideoSourceRequest,
  AdminPreviewScrapeRequest,
  AdminPreviewScrapeEpisodeData,
  AdminPreviewScrapeSeriesData,
  AdminPreviewScrapeResponseData,
  AdminSaveMediaRequest,
  AdminPreviewScrapeSeriesRequest,
  AdminPreviewBulkSourcesRequest,
  AdminBulkSourceItem,
  AdminPreviewBulkSourcesResponseData,
  AdminScrapeSourcesRequest,
  AdminTmdbPreviewQuery,
  AdminTmdbImportRequest,
  AdminTmdbSyncRequest,
  AdminTmdbSyncPreviewQuery,
  AdminTmdbPreviewSeasonItem,
  AdminTmdbPreviewResponseData,
  AdminPresignUploadRequest,
  AdminPresignUploadResponseData,
  AdminUploadProgressResponseData,
  AdminCreateSeasonRequest,
} from '@repo/contracts';
import type {
  ArchiveIngestJob,
  ArchiveIngestJobConfirmRequest,
  ArchiveIngestJobCreateRequest,
  ArchiveIngestJobProgress,
  ArchiveIngestJobProgressResponse,
  ArchiveIngestJobResponse,
} from '@repo/contracts';

export const SERIES_PAGE_LIMIT = 12;

export type VideoSource = AdminVideoSourceItem;
export type VideoSourceInput = AdminVideoSourceInput;
export type Episode = AdminEpisodeItem;
export type EpisodesListResponse = AdminEpisodesListResponseData;
export type SeriesItem = AdminSeriesItem;
export type SeriesListResponse = AdminSeriesListResponseData;
export type SeasonDetails = AdminSeasonItem;
export type SeriesDetails = AdminSeriesDetails;
export type FetchSeriesParams = AdminSeriesListQuery & {
  tab?: 'all' | 'featured' | 'ongoing';
};
export type FetchEpisodesParams = AdminEpisodesListQuery & {
  source?: 'otakudesu' | 'dramula';
};
export type PreviewScrapeParams = AdminPreviewScrapeRequest;
export type PreviewScrapeEpisodeData = AdminPreviewScrapeEpisodeData;
export type PreviewScrapeSeriesData = AdminPreviewScrapeSeriesData;
export type SaveMediaParams = AdminSaveMediaRequest;
export type AddVideoSourceInput = AdminVideoSourceInput;
export type UpdateVideoSourceInput = AdminUpdateVideoSourceRequest;
export type ReorderEpisodeItem = AdminReorderEpisodesRequestItem;
export type UpdateSeriesParams = AdminUpdateSeriesRequest;
export type UpdateSeasonParams = AdminUpdateSeasonRequest;
export type CreateSeasonParams = AdminCreateSeasonRequest;
export type ImportTmdbParams = AdminTmdbImportRequest;
export type SyncTmdbParams = AdminTmdbSyncRequest;
export type FetchSeriesTmdbSyncPreviewParams = AdminTmdbSyncPreviewQuery;
export type PresignUploadSourceParams = AdminPresignUploadRequest;
export type PresignUploadSourceResult = AdminPresignUploadResponseData;

export type {
  AdminPaginationMeta,
  AdminVideoSourceItem,
  AdminEpisodeItem,
  AdminSeasonItem,
  AdminSeriesItemSeasonSummary,
  AdminSeriesItem,
  AdminSeriesDetails,
  AdminSeriesListQuery,
  AdminSeriesListResponseData,
  AdminUpdateSeriesRequest,
  AdminUpdateSeasonRequest,
  AdminScrapeOngoingSeasonResponseData,
  AdminEpisodesListQuery,
  AdminEpisodesListResponseData,
  AdminUpdateEpisodeRequest,
  AdminReorderEpisodesRequestItem,
  AdminVideoSourceInput,
  AdminAddVideoSourcesRequest,
  AdminUpdateVideoSourceRequest,
  AdminPreviewScrapeRequest,
  AdminPreviewScrapeEpisodeData,
  AdminPreviewScrapeSeriesData,
  AdminPreviewScrapeResponseData,
  AdminSaveMediaRequest,
  AdminPreviewScrapeSeriesRequest,
  AdminPreviewBulkSourcesRequest,
  AdminBulkSourceItem,
  AdminPreviewBulkSourcesResponseData,
  AdminScrapeSourcesRequest,
  AdminTmdbPreviewQuery,
  AdminTmdbImportRequest,
  AdminTmdbSyncRequest,
  AdminTmdbSyncPreviewQuery,
  AdminTmdbPreviewSeasonItem,
  AdminTmdbPreviewResponseData,
  AdminPresignUploadRequest,
  AdminPresignUploadResponseData,
  AdminUploadProgressResponseData,
  AdminCreateSeasonRequest,
  ArchiveIngestJob,
  ArchiveIngestJobConfirmRequest,
  ArchiveIngestJobCreateRequest,
  ArchiveIngestJobProgress,
  ArchiveIngestJobProgressResponse,
  ArchiveIngestJobResponse,
};
