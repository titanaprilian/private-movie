export class TmdbFetchError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "TmdbFetchError";
  }
}

export async function fetchFromTmdb<T>(endpoint: string): Promise<T> {
  const url = `https://api.themoviedb.org/3${endpoint}`;
  const apiKey = process.env.TMDB_API_KEY;

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
