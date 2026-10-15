import type { DbClient } from "@repo/db";
import {
  MediaScraper,
  type BrowserFn,
  type FetchFn as ScraperFetchFn,
} from "@repo/media-scraper";
import { SeriesNotFoundError, SeriesFetchError, TmdbFetchError } from "../errors";
import { createSeriesRepository } from "../catalog/repository";
import { createTmdbRepository } from "./repository";
import type {
  BulkPreviewLocalEpisodeItem,
  FetchTmdbSeriesOptions,
  GetTmdbPreviewOptions,
  PreviewBulkSourcesInput,
  PreviewBulkSourcesResult,
  PreviewScrapeSeriesInput,
  PreviewScrapeSeriesResult,
  ScrapedBulkEpisodeItem,
  TmdbImagesResponse,
  TmdbImageItem,
  TmdbImportInput,
  TmdbPreviewResult,
  TmdbSeasonDetailsResponse,
  TmdbSeriesDetailsResponse,
  TmdbSeriesFullData,
  TmdbService,
  TmdbServiceOptions,
  TmdbSyncInput,
  TmdbSyncPreviewInput,
  TmdbSyncPreviewResult,
  TmdbSeasonFullData,
  EpisodeChangeItem,
  SeasonSyncDiffItem,
  VideoSource,
} from "../types";

export type TmdbHtmlFetchFn = {
  get(url: string): Promise<string>;
  post(url: string, body: string): Promise<string>;
};

export const defaultFetchHtml: TmdbHtmlFetchFn = {
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

export async function fetchFromTmdb<T>(endpoint: string): Promise<T> {
  const url = `https://api.themoviedb.org/3${endpoint}`;
  const apiKey = process.env.TMDB_API_KEY || process.env.TMDB_TOKEN;

  if (!apiKey) {
    throw new TmdbFetchError("Missing TMDB_API_KEY environment variable", 400);
  }

  const headers: Record<string, string> = {
    accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const response = await fetch(url, { headers });

  if (!response.ok) {
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return fetchFromTmdb<T>(endpoint);
    }
    throw new TmdbFetchError(`TMDB API Error: ${response.status} ${response.statusText}`, response.status);
  }

  return response.json() as Promise<T>;
}

export function selectBestTmdbLogo(logos?: TmdbImageItem[]): string | null {
  if (!logos || logos.length === 0) {
    return null;
  }

  const englishLogos = logos.filter(
    (img) => img.iso_639_1 === "en" || img.iso_639_1 === "en-US"
  );

  const candidatePool = englishLogos.length > 0 ? englishLogos : logos;

  const sorted = [...candidatePool].sort(
    (a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0)
  );

  const bestLogo = sorted[0];
  if (!bestLogo?.file_path) {
    return null;
  }

  return `https://image.tmdb.org/t/p/w500${bestLogo.file_path}`;
}

export async function getTmdbPreview(
  tmdbId: number,
  options: GetTmdbPreviewOptions = {}
): Promise<TmdbPreviewResult> {
  const type = options.type ?? "tv";
  const token = options.token ?? process.env.TMDB_TOKEN ?? process.env.TMDB_API_KEY;

  const defaultFetchFn = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, init);
    if (!res.ok) {
      if (res.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return defaultFetchFn(url, init);
      }
      throw new TmdbFetchError(`TMDB API Error: ${res.status} ${res.statusText}`, res.status);
    }
    return res.json();
  };

  const fetchFn = options.fetchFn ?? defaultFetchFn;
  const headers: Record<string, string> = {
    accept: "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (type === "movie") {
    const movieUrl = `https://api.themoviedb.org/3/movie/${tmdbId}`;
    const movieData = (await fetchFn(movieUrl, { headers })) as TmdbSeriesDetailsResponse;

    const movieImagesUrl = `https://api.themoviedb.org/3/movie/${tmdbId}/images?include_image_language=en-US,en,null`;
    const movieImagesData = (await fetchFn(movieImagesUrl, { headers }).catch(() => ({ logos: [] }))) as TmdbImagesResponse;
    const logoUrl = selectBestTmdbLogo(movieImagesData.logos);

    const title = movieData.title || movieData.name || `Movie ${tmdbId}`;
    const posterUrl = movieData.poster_path ? `https://image.tmdb.org/t/p/w500${movieData.poster_path}` : null;
    const backdropUrl = movieData.backdrop_path ? `https://image.tmdb.org/t/p/original${movieData.backdrop_path}` : null;
    const releaseDate = movieData.release_date || movieData.first_air_date || null;

    return {
      title,
      overview: movieData.overview ?? "",
      posterUrl,
      backdropUrl,
      logoUrl,
      releaseDate,
      genres: (movieData.genres || []).map((g) => g.name),
      runtime: movieData.runtime ?? null,
    };
  }

  const seriesUrl = `https://api.themoviedb.org/3/tv/${tmdbId}`;
  const seriesData = (await fetchFn(seriesUrl, { headers })) as TmdbSeriesDetailsResponse;

  const tvImagesUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/images?include_image_language=en-US,en,null`;
  const tvImagesData = (await fetchFn(tvImagesUrl, { headers }).catch(() => ({ logos: [] }))) as TmdbImagesResponse;
  const logoUrl = selectBestTmdbLogo(tvImagesData.logos);

  const includeSpecials = options.includeSpecials ?? false;
  const rawSeasons = Array.isArray(seriesData.seasons) ? seriesData.seasons : [];
  const targetSeasons = rawSeasons.filter((s) => (includeSpecials ? s.season_number >= 0 : s.season_number > 0));

  const seasonsPreview = targetSeasons.map((s) => ({
    seasonNumber: s.season_number,
    name: s.name || `Season ${s.season_number}`,
    episodeCount: s.episode_count ?? 0,
    posterUrl: s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : null,
  }));

  const totalEpisodes = seasonsPreview.reduce((sum, s) => sum + s.episodeCount, 0);

  return {
    title: seriesData.name || seriesData.title || `Series ${tmdbId}`,
    overview: seriesData.overview ?? "",
    posterUrl: seriesData.poster_path ? `https://image.tmdb.org/t/p/w500${seriesData.poster_path}` : null,
    backdropUrl: seriesData.backdrop_path ? `https://image.tmdb.org/t/p/original${seriesData.backdrop_path}` : null,
    logoUrl,
    releaseDate: seriesData.first_air_date ?? null,
    genres: (seriesData.genres || []).map((g) => g.name),
    status: seriesData.status ?? null,
    totalSeasons: seasonsPreview.length,
    totalEpisodes,
    seasons: seasonsPreview,
  };
}

export async function fetchTmdbSeriesData(
  tmdbId: number,
  options: FetchTmdbSeriesOptions = {}
): Promise<TmdbSeriesFullData> {
  const type = options.type ?? "tv";
  const log = options.logFn ?? console.log;
  const sleepFn = options.sleepFn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const token = options.token ?? process.env.TMDB_TOKEN ?? process.env.TMDB_API_KEY;

  const defaultFetchFn = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, init);
    if (!res.ok) {
      if (res.status === 429) {
        log("TMDB rate limit hit. Retrying in 2000ms...");
        await sleepFn(2000);
        return defaultFetchFn(url, init);
      }
      throw new TmdbFetchError(`TMDB API Error: ${res.status} ${res.statusText}`, res.status);
    }
    return res.json();
  };

  const fetchFn = options.fetchFn ?? defaultFetchFn;
  const headers: Record<string, string> = {
    accept: "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (type === "movie") {
    const movieUrl = `https://api.themoviedb.org/3/movie/${tmdbId}`;
    const movieData = (await fetchFn(movieUrl, { headers })) as TmdbSeriesDetailsResponse;

    const title = movieData.title || movieData.name || `Movie ${tmdbId}`;
    const posterPath = movieData.poster_path ? `https://image.tmdb.org/t/p/w500${movieData.poster_path}` : null;
    const backdropPath = movieData.backdrop_path ? `https://image.tmdb.org/t/p/original${movieData.backdrop_path}` : null;
    const releaseDate = movieData.release_date || movieData.first_air_date || null;
    const overview = movieData.overview ?? null;
    const imagesUrl = `https://api.themoviedb.org/3/movie/${tmdbId}/images?include_image_language=en-US,en,null`;
    const imagesData = (await fetchFn(imagesUrl, { headers }).catch(() => ({ logos: [] }))) as TmdbImagesResponse;
    const logoUrl = selectBestTmdbLogo(imagesData.logos);

    const artificialSeason: TmdbSeasonFullData = {
      seasonNumber: 1,
      name: title,
      overview,
      posterPath,
      airDate: releaseDate,
      episodes: [
        {
          id: movieData.id,
          episode_number: 1,
          name: title,
          overview,
          runtime: movieData.runtime ?? null,
          still_path: movieData.poster_path || movieData.backdrop_path || null,
          vote_average: movieData.vote_average ?? null,
          air_date: releaseDate,
        },
      ],
    };

    return {
      tmdbId: movieData.id ?? tmdbId,
      type: "movie",
      title,
      description: overview,
      posterPath,
      backdropPath,
      logoUrl,
      firstAirDate: releaseDate,
      voteAverage: movieData.vote_average ?? null,
      genres: (movieData.genres || []).map((g) => g.name),
      seasons: [artificialSeason],
    };
  }

  const seriesUrl = `https://api.themoviedb.org/3/tv/${tmdbId}`;
  const seriesData = (await fetchFn(seriesUrl, { headers })) as TmdbSeriesDetailsResponse;

  const tvImagesUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/images?include_image_language=en-US,en,null`;
  const tvImagesData = (await fetchFn(tvImagesUrl, { headers }).catch(() => ({ logos: [] }))) as TmdbImagesResponse;
  const logoUrl = selectBestTmdbLogo(tvImagesData.logos);

  const includeSpecials = options.includeSpecials ?? false;
  const rawSeasons = Array.isArray(seriesData.seasons) ? seriesData.seasons : [];
  const targetSeasons = rawSeasons.filter((s) => (includeSpecials ? s.season_number >= 0 : s.season_number > 0));

  const seasonsFullData: TmdbSeasonFullData[] = await Promise.all(
    targetSeasons.map(async (sMeta) => {
      const seasonUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${sMeta.season_number}`;
      const seasonData = (await fetchFn(seasonUrl, { headers })) as TmdbSeasonDetailsResponse;

      return {
        seasonNumber: sMeta.season_number,
        name: seasonData.name ?? sMeta.name ?? `Season ${sMeta.season_number}`,
        overview: seasonData.overview ?? sMeta.overview ?? null,
        posterPath: seasonData.poster_path
          ? `https://image.tmdb.org/t/p/w500${seasonData.poster_path}`
          : sMeta.poster_path
            ? `https://image.tmdb.org/t/p/w500${sMeta.poster_path}`
            : null,
        airDate: seasonData.air_date ?? sMeta.air_date ?? null,
        episodes: Array.isArray(seasonData.episodes) ? seasonData.episodes : [],
      };
    })
  );

  return {
    tmdbId: seriesData.id ?? tmdbId,
    type: "tv",
    title: seriesData.name || seriesData.title || `Series ${tmdbId}`,
    description: seriesData.overview ?? null,
    posterPath: seriesData.poster_path ? `https://image.tmdb.org/t/p/w500${seriesData.poster_path}` : null,
    backdropPath: seriesData.backdrop_path ? `https://image.tmdb.org/t/p/original${seriesData.backdrop_path}` : null,
    logoUrl,
    firstAirDate: seriesData.first_air_date ?? null,
    voteAverage: seriesData.vote_average ?? null,
    genres: (seriesData.genres || []).map((g) => g.name),
    seasons: seasonsFullData,
  };
}

export function stripSeasonDescriptors(title: string): string {
  let out = title;
  out = out.replace(/\b\d+(?:st|nd|rd|th)\s+season\b/gi, " ");
  out = out.replace(
    /\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+seasons?\b/gi,
    " "
  );
  out = out.replace(/\bseasons?\s+\d+\b/gi, " ");
  out = out.replace(/\bseasons?\s+[IVXLCDM]+\b/gi, " ");
  out = out.replace(/\b(?:part|cour)\s+(?:\d+|[IVXLCDM]+)\b/gi, " ");
  out = out.replace(/\b[IVXLCDM]{2,}\b/g, " ");
  return out.replace(/\s{2,}/g, " ").trim();
}

export function parseBulkScrapedEpisodeNumber(title: string): number | null {
  const normalized = stripSeasonDescriptors(title);

  const decimalEpMatch = normalized.match(/(?:episode|eps|ep|#)\.?\s*(\d+\.\d+)/i);
  if (decimalEpMatch) {
    const num = parseFloat(decimalEpMatch[1]);
    if (!Number.isNaN(num)) return num;
  }

  const epMatch = normalized.match(/(?:episode|eps|ep|#)\.?\s*(\d+)/i);
  if (epMatch) {
    const num = parseInt(epMatch[1], 10);
    if (!Number.isNaN(num)) return num;
  }

  const titleWithoutSeason = normalized.replace(/\bseason\s*\d+/gi, "").replace(/\bs\d+\b/gi, "");

  const decimalMatch = titleWithoutSeason.match(/\b(\d+\.\d+)\b/);
  if (decimalMatch) {
    const num = parseFloat(decimalMatch[1]);
    if (!Number.isNaN(num)) return num;
  }

  const numMatch = titleWithoutSeason.match(/\b(\d+)\b/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (!Number.isNaN(num) && (num < 1900 || num > 2100)) return num;
  }

  return null;
}

export function createTmdbService(db: DbClient, options?: TmdbServiceOptions): TmdbService {
  const tmdbRepository = createTmdbRepository(db);
  const catalogRepository = createSeriesRepository(db);
  const fetchHtml: TmdbHtmlFetchFn = options?.fetchHtml ?? defaultFetchHtml;

  async function previewScrapeSeries(
    input: PreviewScrapeSeriesInput
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
        source: input.source as VideoSource,
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

  async function previewBulkSources(
    input: PreviewBulkSourcesInput
  ): Promise<PreviewBulkSourcesResult> {
    const targetSeries = await catalogRepository.findById(input.seriesId);
    if (!targetSeries) {
      throw new SeriesNotFoundError(`Series with id ${input.seriesId} not found`);
    }

    const parsedSeries = await previewScrapeSeries({
      sourceUrl: input.sourceUrl,
      source: input.source,
      html: input.html,
    });

    const fullSeries = await catalogRepository.findByIdWithEpisodes(input.seriesId);
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
  }

  async function getTmdbSyncPreview(
    seriesId: string,
    input: TmdbSyncPreviewInput
  ): Promise<TmdbSyncPreviewResult> {
    const existingSeries = await tmdbRepository.findByIdWithEpisodes(seriesId);
    if (!existingSeries) {
      throw new SeriesNotFoundError(`Series with id ${seriesId} not found`);
    }

    const data = await fetchTmdbSeriesData(input.tmdbId, {
      type: input.type,
      includeSpecials: input.includeSpecials,
    });

    const incomingRating = data.voteAverage ? String(data.voteAverage) : null;
    const seriesUpdated =
      (existingSeries.description ?? null) !== (data.description ?? null) ||
      (existingSeries.posterUrl ?? null) !== (data.posterPath ?? null) ||
      (existingSeries.backdropUrl ?? null) !== (data.backdropPath ?? null) ||
      (existingSeries.logoUrl ?? null) !== (data.logoUrl ?? null) ||
      (existingSeries.rating ?? null) !== (incomingRating ?? null) ||
      (existingSeries.title ?? null) !== (data.title ?? null);

    const seasonDiffs: SeasonSyncDiffItem[] = [];
    const episodeChanges: EpisodeChangeItem[] = [];

    const localSeasons = existingSeries.seasons ?? [];
    const localAllEpisodes = existingSeries.episodes ?? [];

    for (const sMeta of data.seasons) {
      const localSeason = localSeasons.find((s) => s.seasonNumber === sMeta.seasonNumber);

      let isNewSeason = false;
      let localEpisodes: typeof localAllEpisodes = [];

      if (localSeason) {
        localEpisodes = localSeason.episodes ?? [];
      } else if (
        localSeasons.length === 0 &&
        sMeta.seasonNumber === 1 &&
        localAllEpisodes.length > 0
      ) {
        localEpisodes = localAllEpisodes;
      } else {
        isNewSeason = true;
      }

      const diff = isNewSeason
        ? sMeta.episodes.length
        : Math.max(0, sMeta.episodes.length - localEpisodes.length);

      let badgeText: string;
      let badgeType: SeasonSyncDiffItem["badgeType"];

      if (isNewSeason) {
        badgeText = `New Season (${sMeta.episodes.length} ${
          sMeta.episodes.length === 1 ? "ep" : "eps"
        })`;
        badgeType = "new-season";
      } else if (diff > 0) {
        badgeText = `+${diff} new ${diff === 1 ? "ep" : "eps"} (${localEpisodes.length} → ${sMeta.episodes.length})`;
        badgeType = "new-eps";
      } else {
        badgeText = `Existing (${localEpisodes.length} ${
          localEpisodes.length === 1 ? "ep" : "eps"
        })`;
        badgeType = "existing";
      }

      seasonDiffs.push({
        seasonNumber: sMeta.seasonNumber,
        name: sMeta.name ?? `Season ${sMeta.seasonNumber}`,
        incomingEpisodeCount: sMeta.episodes.length,
        localEpisodeCount: localEpisodes.length,
        diff,
        isNewSeason,
        badgeText,
        badgeType,
      });

      if (!isNewSeason && localEpisodes.length > 0) {
        for (const ep of sMeta.episodes) {
          const localEp = localEpisodes.find((e) => e.order === ep.episode_number);
          if (localEp) {
            const incomingTitle = ep.name || `Episode ${ep.episode_number}`;
            const incomingOverview = ep.overview ?? null;
            const incomingThumbnail = ep.still_path
              ? ep.still_path.startsWith("http")
                ? ep.still_path
                : `https://image.tmdb.org/t/p/w500${ep.still_path}`
              : null;
            const incomingAirDate = ep.air_date
              ? new Date(ep.air_date).toISOString().split("T")[0]
              : null;
            const oldAirDate = localEp.airDate
              ? localEp.airDate instanceof Date
                ? localEp.airDate.toISOString().split("T")[0]
                : String(localEp.airDate).split("T")[0]
              : null;

            const titleChanged = (localEp.title ?? "") !== incomingTitle;
            const overviewChanged = (localEp.description ?? null) !== incomingOverview;
            const thumbnailChanged = (localEp.thumbnailUrl ?? null) !== incomingThumbnail;
            const airDateChanged = (oldAirDate ?? null) !== incomingAirDate;

            if (titleChanged || overviewChanged || thumbnailChanged || airDateChanged) {
              episodeChanges.push({
                seasonNumber: sMeta.seasonNumber,
                episodeNumber: ep.episode_number,
                oldTitle: localEp.title,
                newTitle: incomingTitle,
                oldOverview: localEp.description ?? null,
                newOverview: incomingOverview,
                oldThumbnailUrl: localEp.thumbnailUrl ?? null,
                newThumbnailUrl: incomingThumbnail,
                oldAirDate: oldAirDate ?? null,
                newAirDate: incomingAirDate ?? null,
                titleChanged,
                overviewChanged,
                thumbnailChanged,
                airDateChanged,
              });
            }
          }
        }
      }
    }

    const totalNewEpisodes = seasonDiffs.reduce((acc, item) => acc + item.diff, 0);
    const totalNewSeasons = seasonDiffs.filter((item) => item.isNewSeason).length;
    const totalUpdatedEpisodes = episodeChanges.length;

    return {
      seriesId,
      seriesUpdated,
      series: {
        title: data.title,
        overview: data.description,
        posterUrl: data.posterPath,
        backdropUrl: data.backdropPath,
        logoUrl: data.logoUrl,
        rating: incomingRating,
        releaseDate: data.firstAirDate,
        genres: data.genres,
      },
      totalNewEpisodes,
      totalNewSeasons,
      totalUpdatedEpisodes,
      seasonDiffs,
      episodeChanges,
    };
  }

  return {
    async getTmdbPreview(type: "tv" | "movie", tmdbId: number, includeSpecials?: boolean) {
      return getTmdbPreview(tmdbId, { type, includeSpecials });
    },

    async importTmdb(input: TmdbImportInput) {
      const data = await fetchTmdbSeriesData(input.tmdbId, {
        type: input.type,
        includeSpecials: input.includeSpecials,
      });
      return tmdbRepository.saveTmdbSeries(data);
    },

    getTmdbSyncPreview,

    async syncTmdb(seriesId: string, input: TmdbSyncInput) {
      const existingSeries = await tmdbRepository.findById(seriesId);
      if (!existingSeries) {
        throw new SeriesNotFoundError(`Series with id ${seriesId} not found`);
      }

      const data = await fetchTmdbSeriesData(input.tmdbId, {
        type: input.type,
        includeSpecials: input.includeSpecials,
      });

      await tmdbRepository.syncTmdbSeries(seriesId, data, {
        skipGenres: input.skipGenres,
        type: input.type,
      });

      const updated = await tmdbRepository.findByIdWithEpisodes(seriesId);
      return updated!;
    },

    previewScrapeSeries,
    previewBulkSources,
  };
}

export type TmdbServiceClient = ReturnType<typeof createTmdbService>;
export { TmdbFetchError };
export type { BrowserFn };
