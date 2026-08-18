import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { SeriesRow } from "@repo/db";
import {
  MediaScraper,
  extractDirectVideoSources,
  parseEpisodeOrder,
  resolveMirrors,
  type ParsedMetadata,
  type ParsedVideoSource,
  type ParsedMirrorPayload,
  type ParsedAjaxActions,
  type ParsedDownloadLink,
  type FetchFn as ScraperFetchFn,
} from "@repo/media-scraper";
import { createEpisodeRepositoryInternal, EpisodeNotFoundError, type EpisodeWithVideoSources } from "./internal/episodes/repository";
import { createSeriesRepositoryInternal } from "./internal/series/repository";
import { createVideoSourceRepositoryInternal, VideoSourceNotFoundError } from "./internal/video-sources/repository";

export type VideoSource = "otakudesu";

export type { EpisodeRow as SavedEpisode, SeriesRow as SavedSeries } from "@repo/db";
export type { EpisodeWithVideoSources };
export { VideoSourceNotFoundError } from "./internal/video-sources/repository";
export {
  EpisodeParseError,
  EpisodeMissingFieldsError,
  SeriesParseError,
  MirrorResolveError,
} from "@repo/media-scraper";

export type FetchFn = {
  get(url: string): Promise<string>;
  post(url: string, body: string): Promise<string>;
};

export const defaultFetchFn: FetchFn = {
  async get(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch HTML from ${url}: ${response.statusText}`);
    }
    return response.text();
  },
  async post(url: string, body: string) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      throw new Error(`Failed to POST to ${url}: ${response.statusText}`);
    }
    return response.text();
  },
};

export class EpisodeFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EpisodeFetchError";
  }
}

export class SeriesFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeriesFetchError";
  }
}

export interface SaveEpisodeInput {
  sourceUrl: string;
  source: VideoSource;
  html?: string;
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

export interface PreviewScrapeSeriesResult {
  series: {
    sourceUrl: string;
    source: VideoSource;
    title: string;
    description: string | null;
    posterUrl: string | null;
  };
  episodes: Array<{
    title: string;
    url: string;
    date: string | null;
  }>;
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
  fetchHtml?: FetchFn;
}

export interface MediaService {
  previewScrape(input: SaveEpisodeInput): Promise<PreviewScrapeResult>;
  previewScrapeSeries(input: SaveEpisodeInput): Promise<PreviewScrapeSeriesResult>;
  saveMedia(input: SaveMediaInput): Promise<SaveMediaResult>;
}

export type SaveEpisodeService = MediaService;

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
  const fetchHtml = options?.fetchHtml ?? defaultFetchFn;

  return {
    async previewScrape(input: SaveEpisodeInput): Promise<PreviewScrapeResult> {
      const provider = MediaScraper.getProviderForUrl(input.sourceUrl);
      if (!provider) {
        throw new EpisodeFetchError(`No provider found for ${input.sourceUrl}`);
      }

      let html = input.html;
      if (!html) {
        try {
          html = await fetchHtml.get(input.sourceUrl);
        } catch (error) {
          throw new EpisodeFetchError(
            `Failed to fetch HTML from ${input.sourceUrl}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      const effectiveFetch: ScraperFetchFn = {
        get: async (url: string) => {
          if (url === input.sourceUrl && html) {
            return html;
          }
          return fetchHtml.get(url);
        },
        post: (url: string, body: string) => fetchHtml.post(url, body),
      };

      const scraped = await provider.parseEpisode(input.sourceUrl, effectiveFetch);
      const warnings: string[] = [];
      let series: PreviewScrapeResult["series"] = null;

      // Extract direct video sources from the primary embed iframe
      let directSources: ParsedVideoSource[] = [];
      const embedSource = scraped.videoSources.find(
        (vs) => vs.type === "embed"
      );
      if (embedSource?.url) {
        try {
          const iframeHtml = await fetchHtml.get(embedSource.url);
          directSources = extractDirectVideoSources(iframeHtml);
        } catch {
          // will retry with resolved mirrors below
        }
      }

      if (scraped.animePageUrl) {
        try {
          const seriesResult = await provider.parseSeries(scraped.animePageUrl, fetchHtml);
          series = {
            sourceUrl: scraped.animePageUrl,
            source: input.source,
            title: seriesResult.title,
            description: seriesResult.description ?? null,
            posterUrl: seriesResult.posterUrl ?? null,
          };
        } catch {
          warnings.push("Failed to fetch series details");
        }
      }

      let videoSources: PreviewScrapeVideoSource[] = scraped.videoSources.map((vs) => ({
        type: vs.type,
        url: vs.url,
        label: vs.label,
        ...(vs.quality !== undefined ? { quality: vs.quality } : {}),
      }));

      const mirrorPayloads = (scraped.providerData?.mirrorPayloads ?? []) as ParsedMirrorPayload[];
      const ajaxActions = (scraped.providerData?.ajaxActions ?? null) as ParsedAjaxActions | null;

      if (mirrorPayloads.length > 0) {
        if (!ajaxActions) {
          warnings.push(
            "Failed to extract AJAX actions; mirror resolution skipped"
          );
        } else {
          const resolved = await resolveMirrors({
            payloads: mirrorPayloads,
            fetchFn: fetchHtml,
            nonceAction: ajaxActions.nonceAction,
            mirrorAction: ajaxActions.mirrorAction,
          });
          videoSources = resolved.map((mirror) => ({
            type: "embed",
            url: mirror.url,
            label: mirror.label,
            quality: "720p",
          }));

          // If the primary embed iframe had no direct MP4, try resolved mirrors
          if (directSources.length === 0 && resolved.length > 0) {
            const desuMirror = resolved.find(
              (m) => m.url.includes("desustream.net") || m.label.toLowerCase().includes("odstream")
            );
            if (desuMirror?.url) {
              try {
                const mirrorHtml = await fetchHtml.get(desuMirror.url);
                directSources = extractDirectVideoSources(mirrorHtml);
              } catch {
                // no warning, just skip — embed sources are still present
              }
            }
          }
        }
      }

      // Merge direct sources into videoSources
      if (directSources.length > 0) {
        const directPreview = directSources.map(
          (ds) =>
            ({
              type: ds.type,
              url: ds.url,
              label: ds.label,
              quality: ds.quality ?? null,
            }) as PreviewScrapeVideoSource
        );
        videoSources.push(...directPreview);
      }

      const metadata: ParsedMetadata = {};
      if (scraped.genres) metadata.genres = scraped.genres;
      if (scraped.duration) metadata.duration = scraped.duration;
      if (scraped.posterUrl) metadata.posterUrl = scraped.posterUrl;
      if (scraped.animePageUrl) metadata.animePageUrl = scraped.animePageUrl;
      if (scraped.downloadLinks) metadata.downloadLinks = scraped.downloadLinks as ParsedDownloadLink[];
      if (scraped.episodes) {
        metadata.episodes = scraped.episodes.map((ep) => ({
          label: ep.title,
          url: ep.url,
        }));
      }

      return {
        episode: {
          sourceUrl: input.sourceUrl,
          source: input.source,
          title: scraped.title,
          videoType: scraped.videoType ?? null,
          videoSources,
          metadata,
        },
        series,
        warnings,
      };
    },

    async previewScrapeSeries(
      input: SaveEpisodeInput
    ): Promise<PreviewScrapeSeriesResult> {
      const provider = MediaScraper.getProviderForUrl(input.sourceUrl);
      if (!provider) {
        throw new SeriesFetchError(`No provider found for ${input.sourceUrl}`);
      }

      let html = input.html;
      if (!html) {
        try {
          html = await fetchHtml.get(input.sourceUrl);
        } catch (error) {
          throw new SeriesFetchError(
            `Failed to fetch HTML from ${input.sourceUrl}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      const effectiveFetch: ScraperFetchFn = {
        get: async (url: string) => {
          if (url === input.sourceUrl && html) {
            return html;
          }
          return fetchHtml.get(url);
        },
        post: (url: string, body: string) => fetchHtml.post(url, body),
      };

      const parsed = await provider.parseSeries(input.sourceUrl, effectiveFetch);
      return {
        series: {
          sourceUrl: input.sourceUrl,
          source: input.source,
          title: parsed.title,
          description: parsed.description ?? null,
          posterUrl: parsed.posterUrl ?? null,
        },
        episodes: parsed.episodes.map((ep) => ({
          title: ep.title,
          url: ep.url,
          date: ep.date ?? null,
        })),
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
