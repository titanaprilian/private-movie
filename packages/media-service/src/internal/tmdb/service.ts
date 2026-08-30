import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import {
  episodes,
  genres,
  seasons,
  series,
  seriesToGenres,
  slugifyGenre,
} from "@repo/db";
import { createSeriesRepositoryInternal, type SeriesWithSeasons } from "../series/repository";

export class TmdbFetchError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "TmdbFetchError";
  }
}

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

export interface TmdbPreviewResult {
  title: string;
  overview: string;
  posterUrl: string | null;
}

export interface TmdbSeasonEpisodeItem {
  id?: number;
  episode_number: number;
  name?: string | null;
  overview?: string | null;
  runtime?: number | null;
  still_path?: string | null;
  vote_average?: number | null;
  air_date?: string | null;
  season_number?: number;
  [key: string]: unknown;
}

export interface TmdbSeasonResponse {
  id?: number;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  season_number?: number;
  episodes?: TmdbSeasonEpisodeItem[];
  [key: string]: unknown;
}

export interface TmdbSeriesSeasonMeta {
  id?: number;
  season_number: number;
  name?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  air_date?: string | null;
  episode_count?: number;
}

export interface TmdbSeriesDetailsResponse {
  id: number;
  name?: string;
  title?: string;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string | null;
  release_date?: string | null;
  vote_average?: number | null;
  status?: string | null;
  runtime?: number | null;
  genres?: Array<{ id: number; name: string }>;
  seasons?: TmdbSeriesSeasonMeta[];
  [key: string]: unknown;
}

export interface TmdbEpisodeDetails {
  id?: number;
  episode_number: number;
  name?: string | null;
  overview?: string | null;
  runtime?: number | null;
  still_path?: string | null;
  vote_average?: number | null;
  air_date?: string | null;
  [key: string]: unknown;
}

export interface TmdbSeasonDetailsResponse {
  id?: number;
  season_number?: number;
  name?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  air_date?: string | null;
  episodes?: TmdbEpisodeDetails[];
  [key: string]: unknown;
}

export interface TmdbSeasonFullData {
  seasonNumber: number;
  name: string;
  overview: string | null;
  posterPath: string | null;
  airDate: string | null;
  episodes: TmdbEpisodeDetails[];
}

export interface TmdbSeriesFullData {
  tmdbId: number;
  type: "tv" | "movie";
  title: string;
  description: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  firstAirDate: string | null;
  voteAverage: number | null;
  genres: string[];
  seasons: TmdbSeasonFullData[];
}

export interface FetchTmdbSeriesOptions {
  type?: "tv" | "movie";
  token?: string;
  fetchFn?: (url: string, init?: RequestInit) => Promise<any>;
  logFn?: (message: string) => void;
  sleepFn?: (ms: number) => Promise<void>;
  includeSpecials?: boolean;
}

export interface TmdbImportInput {
  type: "tv" | "movie";
  tmdbId: number;
  includeSpecials?: boolean;
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
      throw new Error(`TMDB API Error: ${res.status} ${res.statusText}`);
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
    const movieData: TmdbSeriesDetailsResponse = await fetchFn(movieUrl, { headers });

    const title = movieData.title || movieData.name || `Movie ${tmdbId}`;
    const posterPath = movieData.poster_path ? `https://image.tmdb.org/t/p/w500${movieData.poster_path}` : null;
    const backdropPath = movieData.backdrop_path ? `https://image.tmdb.org/t/p/w500${movieData.backdrop_path}` : null;
    const releaseDate = movieData.release_date || movieData.first_air_date || null;
    const overview = movieData.overview ?? null;

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
      firstAirDate: releaseDate,
      voteAverage: movieData.vote_average ?? null,
      genres: (movieData.genres || []).map((g) => g.name),
      seasons: [artificialSeason],
    };
  } else {
    const seriesUrl = `https://api.themoviedb.org/3/tv/${tmdbId}`;
    const seriesData: TmdbSeriesDetailsResponse = await fetchFn(seriesUrl, { headers });

    const includeSpecials = options.includeSpecials ?? false;
    const rawSeasons = Array.isArray(seriesData.seasons) ? seriesData.seasons : [];
    const targetSeasons = rawSeasons.filter((s) => (includeSpecials ? s.season_number >= 0 : s.season_number > 0));

    const seasonsFullData: TmdbSeasonFullData[] = [];

    for (const sMeta of targetSeasons) {
      const seasonUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${sMeta.season_number}`;
      const seasonData: TmdbSeasonDetailsResponse = await fetchFn(seasonUrl, { headers });

      seasonsFullData.push({
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
      });
    }

    return {
      tmdbId: seriesData.id ?? tmdbId,
      type: "tv",
      title: seriesData.name || seriesData.title || `Series ${tmdbId}`,
      description: seriesData.overview ?? null,
      posterPath: seriesData.poster_path ? `https://image.tmdb.org/t/p/w500${seriesData.poster_path}` : null,
      backdropPath: seriesData.backdrop_path ? `https://image.tmdb.org/t/p/w500${seriesData.backdrop_path}` : null,
      firstAirDate: seriesData.first_air_date ?? null,
      voteAverage: seriesData.vote_average ?? null,
      genres: (seriesData.genres || []).map((g) => g.name),
      seasons: seasonsFullData,
    };
  }
}

export async function saveTmdbSeries(
  db: any,
  data: TmdbSeriesFullData
): Promise<SeriesWithSeasons> {
  let createdSeriesRow: any = null;

  await db.transaction(async (tx: any) => {
    // 1. Upsert Series
    const [seriesRow] = await tx
      .insert(series)
      .values({
        id: randomUUID(),
        title: data.title,
        description: data.description,
        posterUrl: data.posterPath,
        backdropUrl: data.backdropPath,
        rating: data.voteAverage ? String(data.voteAverage) : null,
        tmdbId: data.tmdbId,
        type: data.type ?? "tv",
        createdAt: new Date(),
        updatedAt: new Date(),
        tmdbSyncStatus: "SYNCED",
      })
      .onConflictDoUpdate({
        target: series.tmdbId,
        set: {
          title: data.title,
          description: data.description,
          type: data.type ?? "tv",
          posterUrl: data.posterPath,
          backdropUrl: data.backdropPath,
          rating: data.voteAverage ? String(data.voteAverage) : null,
          updatedAt: new Date(),
          tmdbSyncStatus: "SYNCED",
        },
      })
      .returning();

    createdSeriesRow = seriesRow;

    // 2. Wipe existing series-to-genre mappings for this series
    await tx
      .delete(seriesToGenres)
      .where(eq(seriesToGenres.seriesId, seriesRow.id));

    // 3. Upsert Genres and Create Series-to-Genre Relations
    const rawGenres = data.genres || [];
    const genreNames = Array.from(
      new Set(rawGenres.map((g) => g.trim()).filter(Boolean))
    );

    if (genreNames.length > 0) {
      const genreValues = genreNames.map((name) => ({
        id: randomUUID(),
        name,
        slug: slugifyGenre(name),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const genreRows = await tx
        .insert(genres)
        .values(genreValues)
        .onConflictDoUpdate({
          target: genres.name,
          set: {
            updatedAt: new Date(),
          },
        })
        .returning({ id: genres.id });

      const seriesToGenreRows = (genreRows || []).map((g: any) => ({
        seriesId: seriesRow.id,
        genreId: g.id,
      }));

      if (seriesToGenreRows.length > 0) {
        await tx
          .insert(seriesToGenres)
          .values(seriesToGenreRows)
          .onConflictDoNothing();
      }
    }

    // 4. Upsert Seasons and Episodes
    for (const season of data.seasons) {
      const [seasonRow] = await tx
        .insert(seasons)
        .values({
          id: randomUUID(),
          seriesId: seriesRow.id,
          seasonNumber: season.seasonNumber,
          title: season.name,
          description: season.overview,
          posterUrl: season.posterPath,
          createdAt: new Date(),
          updatedAt: new Date(),
          tmdbSyncStatus: "SYNCED",
        })
        .onConflictDoUpdate({
          target: [seasons.seriesId, seasons.seasonNumber],
          set: {
            title: season.name,
            description: season.overview,
            posterUrl: season.posterPath,
            updatedAt: new Date(),
            tmdbSyncStatus: "SYNCED",
          },
        })
        .returning();

      for (const episode of season.episodes) {
        const thumbnailUrl = episode.still_path
          ? episode.still_path.startsWith("http")
            ? episode.still_path
            : `https://image.tmdb.org/t/p/w500${episode.still_path}`
          : null;

        await tx
          .insert(episodes)
          .values({
            id: randomUUID(),
            seasonId: seasonRow.id,
            order: episode.episode_number,
            title: episode.name || `Episode ${episode.episode_number}`,
            description: episode.overview,
            thumbnailUrl,
            rating: episode.vote_average ? String(episode.vote_average) : null,
            airDate: episode.air_date ? new Date(episode.air_date) : null,
            duration: episode.runtime || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [episodes.seasonId, episodes.order],
            set: {
              title: episode.name || `Episode ${episode.episode_number}`,
              description: episode.overview,
              thumbnailUrl,
              rating: episode.vote_average ? String(episode.vote_average) : null,
              airDate: episode.air_date ? new Date(episode.air_date) : null,
              duration: episode.runtime || null,
              updatedAt: new Date(),
            },
          });
      }
    }
  });

  const hasSelect = typeof db.select === "function";
  const seriesRepository = hasSelect ? createSeriesRepositoryInternal(db) : null;
  const foundSeries = seriesRepository && createdSeriesRow ? await seriesRepository.findById(createdSeriesRow.id).catch(() => null) : null;
  const childSeasons = hasSelect && createdSeriesRow
    ? await db
        .select()
        .from(seasons)
        .where(eq(seasons.seriesId, createdSeriesRow.id))
        .orderBy(asc(seasons.createdAt))
        .catch(() => [])
    : [];

  return {
    ...(foundSeries ?? createdSeriesRow ?? {}),
    seasons: childSeasons ?? [],
  };
}

export async function fetchTmdbSeasonDetails(tmdbId: number, seasonNumber: number): Promise<TmdbSeasonResponse> {
  return fetchFromTmdb<TmdbSeasonResponse>(`/tv/${tmdbId}/season/${seasonNumber}?language=en-US`);
}

export async function getTmdbPreview(type: "movie" | "tv", tmdbId: number, season?: number): Promise<TmdbPreviewResult> {
  let title = "";
  let overview = "";
  let poster_path: string | null = null;
  
  if (type === "movie") {
    const data = await fetchFromTmdb<any>(`/movie/${tmdbId}?language=en-US`);
    title = data.title || "";
    overview = data.overview || "";
    poster_path = data.poster_path;
  } else {
    const details = await fetchFromTmdb<any>(`/tv/${tmdbId}?language=en-US`);
    const seasonData = season !== undefined && Array.isArray(details.seasons)
      ? details.seasons.find((s: any) => s.season_number === season)
      : null;

    title = details.name || "";
    overview = seasonData?.overview || details.overview || "";
    poster_path = seasonData?.poster_path || details.poster_path;
  }

  return {
    title,
    overview,
    posterUrl: poster_path ? `https://image.tmdb.org/t/p/w500${poster_path}` : null,
  };
}

