import { TmdbFetchError } from "../../errors";
import type {
  FetchTmdbSeriesOptions,
  GetTmdbPreviewOptions,
  TmdbHtmlFetchFn,
  TmdbImageItem,
  TmdbImagesResponse,
  TmdbPreviewResult,
  TmdbSeasonDetailsResponse,
  TmdbSeasonFullData,
  TmdbSeriesDetailsResponse,
  TmdbSeriesFullData,
} from "../types";

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
