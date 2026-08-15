import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { EpisodeRow } from "@repo/db";
import { parseEpisodePage } from "./internal/episodes/parse";
import { createEpisodeRepositoryInternal } from "./internal/episodes/repository";
import { parseSeriesPage } from "./internal/series/parse";
import { createSeriesRepositoryInternal } from "./internal/series/repository";

export type VideoSource = "otakudesu";

export type { EpisodeRow as SavedEpisode } from "@repo/db";

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

export interface SaveEpisodeServiceOptions {
  fetchHtml?: FetchHtmlFn;
}

export interface SaveEpisodeService {
  saveEpisodeFromHtml(input: SaveEpisodeInput): Promise<EpisodeRow>;
}

const parsers: Record<VideoSource, typeof parseEpisodePage> = {
  otakudesu: parseEpisodePage,
};

export function createMediaService<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown> = Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  options?: SaveEpisodeServiceOptions
): SaveEpisodeService {
  const episodeRepository = createEpisodeRepositoryInternal(db);
  const seriesRepository = createSeriesRepositoryInternal(db);
  const fetchHtml = options?.fetchHtml ?? defaultFetchHtml;

  return {
    async saveEpisodeFromHtml(input: SaveEpisodeInput): Promise<EpisodeRow> {
      const parsed = parsers[input.source](input.html);
      let seriesId: string | null = null;

      if (parsed.metadata.animePageUrl) {
        try {
          const seriesHtml = await fetchHtml(parsed.metadata.animePageUrl);
          const parsedSeries = parseSeriesPage(
            seriesHtml,
            parsed.metadata.animePageUrl
          );
          const seriesRow = await seriesRepository.upsert({
            sourceUrl: parsed.metadata.animePageUrl,
            source: input.source,
            title: parsedSeries.title,
            description: parsedSeries.description ?? null,
            posterUrl: parsedSeries.posterUrl ?? null,
          });
          seriesId = seriesRow.id;
        } catch {
          // If fetching or parsing series fails, proceed without seriesId
        }
      }

      return episodeRepository.upsert({
        sourceUrl: input.sourceUrl,
        source: input.source,
        title: parsed.title,
        videoType: parsed.videoType,
        videoUrl: parsed.videoUrl,
        metadata: parsed.metadata,
        seriesId,
      });
    },
  };
}

export const createSaveEpisodeService = createMediaService;
