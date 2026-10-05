import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { createSeriesRepositoryInternal, SeriesNotFoundError } from "../series/repository";
import {
  createVideoSourceRepositoryInternal,
  type VideoSourceRepositoryOptions,
} from "../video-sources/repository";
import { parseBulkScrapedEpisodeNumber } from "./episode-number";

export type VideoSource = "otakudesu" | "dramula";

export interface PreviewBulkSourcesInput {
  seriesId: string;
  sourceUrl: string;
  source: VideoSource;
  episodeOffset?: number;
  seasonId?: string;
  html?: string;
}

export interface ScrapedBulkEpisodeItem {
  scrapedTitle: string;
  scrapedUrl: string;
  episodeNumber: number | null;
  calculatedOrder: number | null;
  matchedLocalEpisodeId: string | null;
  matchStatus: "matched" | "unmatched";
}

export interface BulkPreviewLocalEpisodeItem {
  id: string;
  title: string;
  order: number;
  seasonId: string;
  seasonNumber: number | null;
  seasonTitle: string;
  hasSources: boolean;
}

export interface PreviewBulkSourcesResult {
  scrapedEpisodes: ScrapedBulkEpisodeItem[];
  localEpisodes: BulkPreviewLocalEpisodeItem[];
}

export interface BulkSourceItemVideoSource {
  type: "embed" | "direct";
  url: string;
  label: string;
  quality?: string | null;
}

export interface BulkSourceItem {
  episodeId: string | null;
  videoSources: BulkSourceItemVideoSource[];
}

export interface SaveBulkSourcesInput {
  seriesId: string;
  mappings: BulkSourceItem[];
}

export interface SaveBulkSourcesResult {
  success: true;
  savedCount: number;
  skippedCount: number;
}

export interface BulkPreviewScrapeSeriesResult {
  episodes: Array<{ title: string; url: string; date?: string | null }>;
}

export interface BulkServiceOptions extends VideoSourceRepositoryOptions {}

export type PreviewScrapeSeriesFn = (input: {
  sourceUrl: string;
  source: VideoSource;
  html?: string;
}) => Promise<BulkPreviewScrapeSeriesResult>;

export function createBulkServiceInternal<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown> = Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  deps: { previewScrapeSeries: PreviewScrapeSeriesFn },
  options?: BulkServiceOptions
) {
  const seriesRepository = createSeriesRepositoryInternal(db, {
    s3StorageService: options?.s3StorageService,
  });
  const videoSourceRepository = createVideoSourceRepositoryInternal(db, {
    s3StorageService: options?.s3StorageService,
    storageProviderRegistry: options?.storageProviderRegistry,
  });

  return {
    async previewBulkSources(input: PreviewBulkSourcesInput): Promise<PreviewBulkSourcesResult> {
      const targetSeries = await seriesRepository.findById(input.seriesId);
      if (!targetSeries) {
        throw new SeriesNotFoundError(`Series with id ${input.seriesId} not found`);
      }

      const parsedSeries = await deps.previewScrapeSeries({
        sourceUrl: input.sourceUrl,
        source: input.source,
        html: input.html,
      });

      const fullSeries = await seriesRepository.findByIdWithEpisodes(input.seriesId);
      const localEpisodes: BulkPreviewLocalEpisodeItem[] = [];
      const localEpisodesMapByOrder = new Map<number, string>();

      if (fullSeries?.seasons) {
        for (const s of fullSeries.seasons) {
          if (input.seasonId && s.id !== input.seasonId) {
            continue;
          }
          for (const ep of s.episodes) {
            localEpisodes.push({
              id: ep.id,
              title: ep.title,
              order: ep.order,
              seasonId: s.id,
              seasonNumber: s.seasonNumber ?? null,
              seasonTitle: s.title,
              hasSources: Array.isArray(ep.videoSources) && ep.videoSources.length > 0,
            });
            if (!localEpisodesMapByOrder.has(ep.order)) {
              localEpisodesMapByOrder.set(ep.order, ep.id);
            }
          }
        }
      }

      const offset = input.episodeOffset ?? 0;
      const scrapedEpisodes: ScrapedBulkEpisodeItem[] = parsedSeries.episodes.map((scrapedEp) => {
        const epNum = parseBulkScrapedEpisodeNumber(scrapedEp.title);
        let calculatedOrder: number | null = null;
        let matchedLocalEpisodeId: string | null = null;
        let matchStatus: "matched" | "unmatched" = "unmatched";

        if (epNum !== null && Number.isInteger(epNum)) {
          const targetOrder = epNum + offset;
          calculatedOrder = targetOrder;
          const matchedId = localEpisodesMapByOrder.get(targetOrder);
          if (matchedId) {
            matchedLocalEpisodeId = matchedId;
            matchStatus = "matched";
          }
        }

        return {
          scrapedTitle: scrapedEp.title,
          scrapedUrl: scrapedEp.url,
          episodeNumber: epNum,
          calculatedOrder,
          matchedLocalEpisodeId,
          matchStatus,
        };
      });

      return { scrapedEpisodes, localEpisodes };
    },

    async saveBulkSources(input: SaveBulkSourcesInput): Promise<SaveBulkSourcesResult> {
      let savedCount = 0;
      let skippedCount = 0;

      for (const mapping of input.mappings) {
        if (!mapping.episodeId || mapping.videoSources.length === 0) {
          skippedCount++;
          continue;
        }
        for (const vs of mapping.videoSources) {
          await videoSourceRepository.upsert({
            episodeId: mapping.episodeId,
            type: vs.type,
            url: vs.url,
            label: vs.label,
            quality: vs.quality ?? null,
          });
        }
        savedCount++;
      }

      return { success: true, savedCount, skippedCount };
    },
  };
}

export type BulkServiceInternal = ReturnType<typeof createBulkServiceInternal>;
