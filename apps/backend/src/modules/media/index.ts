import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { EpisodeRow, SeriesRow } from "@repo/db";
import { parseEpisodePage, type ParsedMetadata } from "./internal/episodes/parse";
import { createEpisodeRepositoryInternal } from "./internal/episodes/repository";
import { parseSeriesPage } from "./internal/series/parse";
import { createSeriesRepositoryInternal } from "./internal/series/repository";

export type VideoSource = "otakudesu";

export type { EpisodeRow as SavedEpisode, SeriesRow as SavedSeries } from "@repo/db";

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

export interface PreviewScrapeResult {
  episode: {
    sourceUrl: string;
    source: VideoSource;
    title: string;
    videoType: string | null;
    videoUrl: string;
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

export interface SaveMediaEpisodeInput {
  sourceUrl: string;
  source: VideoSource;
  title: string;
  videoType?: string | null;
  videoUrl: string;
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
  episode: EpisodeRow;
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
          videoUrl: parsed.videoUrl,
          metadata: parsed.metadata,
        },
        series,
        warnings,
      };
    },

    async saveMedia(input: SaveMediaInput): Promise<SaveMediaResult> {
      let seriesId: string | null = null;
      let seriesRow: SeriesRow | null = null;

      if (input.series) {
        seriesRow = await seriesRepository.upsert({
          sourceUrl: input.series.sourceUrl,
          source: input.series.source,
          title: input.series.title,
          description: input.series.description ?? null,
          posterUrl: input.series.posterUrl ?? null,
        });
        seriesId = seriesRow.id;
      }

      const episodeRow = await episodeRepository.upsert({
        sourceUrl: input.episode.sourceUrl,
        source: input.episode.source,
        title: input.episode.title,
        videoType: input.episode.videoType ?? null,
        videoUrl: input.episode.videoUrl,
        metadata: input.episode.metadata as ParsedMetadata,
        seriesId,
      });

      return {
        episode: episodeRow,
        series: seriesRow,
      };
    },
  };
}

export const createSaveEpisodeService = createMediaService;
