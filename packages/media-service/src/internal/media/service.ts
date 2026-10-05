import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";
import { seasons, series, type SeriesRow } from "@repo/db";
import {
  MediaScraper,
  EpisodeParseError,
  extractDirectVideoSources,
  parseEpisodeOrder,
  resolveMirrors,
  type ParsedMetadata,
  type ParsedVideoSource,
  type ParsedMirrorPayload,
  type ParsedAjaxActions,
  type ParsedDownloadLink,
  type FetchFn as ScraperFetchFn,
  type BrowserFn,
} from "@repo/media-scraper";
import type { S3StorageService } from "../s3/s3-storage-service";
import {
  normalizeVideoSourcesSync,
  sortVideoSources,
} from "../playback/normalization";
import {
  createEpisodeRepositoryInternal,
  EpisodeNotFoundError,
  type EpisodeWithVideoSources,
} from "../episodes/repository";
import { createSeasonsRepositoryInternal } from "../seasons/repository";
import {
  createSeriesRepositoryInternal,
  type SeriesWithSeasons,
} from "../series/repository";
import { createVideoSourceRepositoryInternal } from "../video-sources/repository";

export type VideoSource = "otakudesu" | "dramula";

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
  tmdbId?: number | null;
}

export interface SaveMediaInput {
  episode: SaveMediaEpisodeInput;
  series?: SaveMediaSeriesInput | null;
}

export interface SaveMediaResult {
  episode: EpisodeWithVideoSources;
  series: SeriesWithSeasons | null;
}

export interface MediaServiceOptions {
  fetchHtml?: FetchFn;
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
}

export function createMediaServiceInternal<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown> = Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  options?: MediaServiceOptions,
) {
  const episodeRepository = createEpisodeRepositoryInternal(db, {
    s3StorageService: options?.s3StorageService,
  });
  const seriesRepository = createSeriesRepositoryInternal(db, {
    s3StorageService: options?.s3StorageService,
  });
  const videoSourceRepository = createVideoSourceRepositoryInternal(db, {
    s3StorageService: options?.s3StorageService,
  });
  const fetchHtml = options?.fetchHtml ?? defaultFetchFn;

  async function previewScrape(input: SaveEpisodeInput): Promise<PreviewScrapeResult> {
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

    if (scraped.videoSources.some((vs) => vs.url.includes(".00000000"))) {
      try {
        const resolved = await provider.resolveVideoSources(
          input.sourceUrl,
          effectiveFetch,
          undefined,
          options?.browserFn
        );
        scraped.videoSources = resolved;
      } catch (error) {
        if (error instanceof EpisodeParseError) {
          warnings.push(
            "Failed to resolve videobello embed hash; sources may not play correctly"
          );
        } else {
          throw error;
        }
      }
    }

    let series: PreviewScrapeResult["series"] = null;

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
        videoSources: sortVideoSources(normalizeVideoSourcesSync(videoSources)),
        metadata,
      },
      series,
      warnings,
    };
  }

  async function previewScrapeSeries(
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
  }

  async function scrapeAndSaveSources(
    episodeId: string,
    sourceUrl: string
  ): Promise<EpisodeWithVideoSources> {
    const episode = await episodeRepository.findById(episodeId);
    if (!episode) {
      throw new EpisodeNotFoundError(`Episode with id ${episodeId} not found`);
    }

    const provider = MediaScraper.getProviderForUrl(sourceUrl);
    if (!provider) {
      throw new EpisodeFetchError(`No provider found for ${sourceUrl}`);
    }

    const sources = await provider.resolveVideoSources(
      sourceUrl,
      fetchHtml,
      undefined,
      options?.browserFn
    );

    await videoSourceRepository.deleteByEpisodeId(episodeId);

    for (const vs of sources) {
      await videoSourceRepository.upsert({
        episodeId,
        type: vs.type,
        url: vs.url,
        label: vs.label,
        quality: vs.quality ?? null,
      });
    }

    const updated = await episodeRepository.findById(episodeId);
    return updated!;
  }

  async function saveMedia(input: SaveMediaInput): Promise<SaveMediaResult> {
    return await db.transaction(async (tx) => {
      const episodeRepositoryTx = createEpisodeRepositoryInternal(tx, {
        s3StorageService: options?.s3StorageService,
      });
      const seriesRepositoryTx = createSeriesRepositoryInternal(tx, {
        s3StorageService: options?.s3StorageService,
      });
      const seasonsRepositoryTx = createSeasonsRepositoryInternal(tx);
      const videoSourceRepositoryTx = createVideoSourceRepositoryInternal(tx, {
        s3StorageService: options?.s3StorageService,
      });

      let seasonId: string | null = null;
      let seriesRow: SeriesRow | null = null;

      const seriesInput: SaveMediaSeriesInput = input.series ?? {
        sourceUrl: input.episode.sourceUrl,
        source: input.episode.source,
        title: input.episode.title,
        description: null,
        posterUrl: null,
      };

      let parentSeriesId: string;
      let existingSeries: SeriesRow | null = null;

      if (seriesInput.tmdbId) {
        existingSeries = await seriesRepositoryTx.findByTmdbId(seriesInput.tmdbId);
      }
      if (!existingSeries && seriesInput.title) {
        const [byTitle] = await tx
          .select()
          .from(series)
          .where(eq(series.title, seriesInput.title));
        existingSeries = byTitle ?? null;
      }

      if (existingSeries) {
        parentSeriesId = existingSeries.id;
        seriesRow = await seriesRepositoryTx.upsert({
          id: parentSeriesId,
          title: seriesInput.title,
          description: seriesInput.description ?? null,
          posterUrl: seriesInput.posterUrl ?? null,
        });
      } else {
        const isMovie =
          input.episode.videoType?.toLowerCase() === "movie" ||
          seriesInput.title.toLowerCase().includes("movie");
        seriesRow = await seriesRepositoryTx.upsert({
          title: seriesInput.title,
          description: seriesInput.description ?? null,
          posterUrl: seriesInput.posterUrl ?? null,
          type: isMovie ? "movie" : "tv",
          tmdbSyncStatus: "PENDING",
        });
        parentSeriesId = seriesRow.id;
      }

      const seasonRow = await seasonsRepositoryTx.upsert({
        seriesId: parentSeriesId,
        title: seriesInput.title,
        description: seriesInput.description ?? null,
        posterUrl: seriesInput.posterUrl ?? null,
        seasonNumber: 1,
      });
      seasonId = seasonRow.id;

      let order = parseEpisodeOrder(input.episode.title);
      if (order === null) {
        const maxOrder = await episodeRepositoryTx.getMaxOrder(seasonId);
        order = maxOrder + 1;
      }

      const episodeRow = await episodeRepositoryTx.upsert({
        title: input.episode.title,
        order,
        seasonId,
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

      const childSeasons = seriesRow
        ? await tx
            .select()
            .from(seasons)
            .where(eq(seasons.seriesId, seriesRow.id))
            .orderBy(asc(seasons.createdAt))
        : [];

      return {
        episode: episodeWithSources!,
        series: seriesRow ? { ...seriesRow, seasons: childSeasons } : null,
      };
    });
  }

  return {
    previewScrape,
    previewScrapeSeries,
    scrapeAndSaveSources,
    saveMedia,
  };
}

export type MediaServiceInternal = ReturnType<typeof createMediaServiceInternal>;
