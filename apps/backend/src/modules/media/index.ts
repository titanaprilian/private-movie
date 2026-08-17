import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { SeriesRow } from "@repo/db";
import { parseEpisodeOrder, parseEpisodePage, type ParsedMetadata } from "./internal/episodes/parse";
import { createEpisodeRepositoryInternal, EpisodeNotFoundError, type EpisodeWithVideoSources } from "./internal/episodes/repository";
import { parseSeriesPage } from "./internal/series/parse";
import { createSeriesRepositoryInternal } from "./internal/series/repository";
import { createVideoSourceRepositoryInternal, VideoSourceNotFoundError } from "./internal/video-sources/repository";

export type VideoSource = "otakudesu";

export type { EpisodeRow as SavedEpisode, SeriesRow as SavedSeries } from "@repo/db";
export type { EpisodeWithVideoSources };
export { VideoSourceNotFoundError } from "./internal/video-sources/repository";

export type FetchHtmlFn = (url: string) => Promise<string>;

export const defaultFetchHtml: FetchHtmlFn = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch HTML from ${url}: ${response.statusText}`);
  }
  return response.text();
};

export interface SaveEpisodeInput {
  sourceUrl: string;
  source: VideoSource;
  html: string;
}

export interface PreviewScrapeVideoSource {
  type: "embed" | "direct";
  url: string;
  label: string;
  quality?: string | null;
}

export interface PreviewScrapeResult {
  episode: {
    sourceUrl: string;
    source: VideoSource;
    title: string;
    videoType: string | null;
    videoSources: PreviewScrapeVideoSource[];
    metadata: ParsedMetadata;
  };
  series: {
    sourceUrl: string;
    source: VideoSource;
    title: string;
    description: string | null;
    posterUrl: string | null;
  } | null;
  warnings: string[];
}

export interface SaveMediaEpisodeVideoSourceInput {
  type: "embed" | "direct";
  url: string;
  label: string;
  quality?: string | null;
}

export interface SaveMediaEpisodeInput {
  sourceUrl: string;
  source: VideoSource;
  title: string;
  videoType?: string | null;
  videoSources?: SaveMediaEpisodeVideoSourceInput[];
  metadata: Record<string, unknown>;
}

export interface SaveMediaSeriesInput {
  sourceUrl: string;
  source: VideoSource;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
}

export interface SaveMediaInput {
  episode: SaveMediaEpisodeInput;
  series?: SaveMediaSeriesInput | null;
}

export interface SaveMediaResult {
  episode: EpisodeWithVideoSources;
  series: SeriesRow | null;
}

export interface SaveEpisodeServiceOptions {
  fetchHtml?: FetchHtmlFn;
}

export interface MediaService {
  previewScrape(input: SaveEpisodeInput): Promise<PreviewScrapeResult>;
  saveMedia(input: SaveMediaInput): Promise<SaveMediaResult>;
}

export type SaveEpisodeService = MediaService;

const parsers: Record<VideoSource, typeof parseEpisodePage> = {
  otakudesu: parseEpisodePage,
};

export function createMediaService<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown> = Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  options?: SaveEpisodeServiceOptions
): MediaService {
  const episodeRepository = createEpisodeRepositoryInternal(db);
  const seriesRepository = createSeriesRepositoryInternal(db);
  const videoSourceRepository = createVideoSourceRepositoryInternal(db);
  const fetchHtml = options?.fetchHtml ?? defaultFetchHtml;

  return {
    async previewScrape(input: SaveEpisodeInput): Promise<PreviewScrapeResult> {
      const parsed = parsers[input.source](input.html);
      const warnings: string[] = [];
      let series: PreviewScrapeResult["series"] = null;

      if (parsed.metadata.animePageUrl) {
        try {
          const seriesHtml = await fetchHtml(parsed.metadata.animePageUrl);
          const parsedSeries = parseSeriesPage(
            seriesHtml,
            parsed.metadata.animePageUrl
          );
          series = {
            sourceUrl: parsed.metadata.animePageUrl,
            source: input.source,
            title: parsedSeries.title,
            description: parsedSeries.description ?? null,
            posterUrl: parsedSeries.posterUrl ?? null,
          };
        } catch {
          warnings.push("Failed to fetch series details");
        }
      }

      return {
        episode: {
          sourceUrl: input.sourceUrl,
          source: input.source,
          title: parsed.title,
          videoType: parsed.videoType,
          videoSources: parsed.videoSources,
          metadata: parsed.metadata,
        },
        series,
        warnings,
      };
    },

    async saveMedia(input: SaveMediaInput): Promise<SaveMediaResult> {
      return await db.transaction(async (tx) => {
        const episodeRepositoryTx = createEpisodeRepositoryInternal(tx);
        const seriesRepositoryTx = createSeriesRepositoryInternal(tx);
        const videoSourceRepositoryTx = createVideoSourceRepositoryInternal(tx);

        let seriesId: string | null = null;
        let seriesRow: SeriesRow | null = null;

        if (input.series) {
          seriesRow = await seriesRepositoryTx.upsert({
            sourceUrl: input.series.sourceUrl,
            source: input.series.source,
            title: input.series.title,
            description: input.series.description ?? null,
            posterUrl: input.series.posterUrl ?? null,
          });
          seriesId = seriesRow.id;
        }

        let order = parseEpisodeOrder(input.episode.title);
        if (order === null) {
          const existing = await episodeRepositoryTx.findBySourceUrl(
            input.episode.sourceUrl
          );
          if (existing) {
            order = existing.order;
          } else {
            const maxOrder = await episodeRepositoryTx.getMaxOrder(seriesId);
            order = maxOrder + 1;
          }
        }

        const episodeRow = await episodeRepositoryTx.upsert({
          sourceUrl: input.episode.sourceUrl,
          source: input.episode.source,
          title: input.episode.title,
          order,
          videoType: input.episode.videoType ?? null,
          metadata: input.episode.metadata as ParsedMetadata,
          seriesId,
        });

        if (input.episode.videoSources && input.episode.videoSources.length > 0) {
          for (const vs of input.episode.videoSources) {
            await videoSourceRepositoryTx.upsert({
              episodeId: episodeRow.id,
              type: vs.type,
              url: vs.url,
              label: vs.label,
              quality: vs.quality ?? null,
            });
          }
        }

        const episodeWithSources = await episodeRepositoryTx.findById(episodeRow.id);

        return {
          episode: episodeWithSources!,
          series: seriesRow,
        };
      });
    },
  };
}

export const createSaveEpisodeService = createMediaService;
