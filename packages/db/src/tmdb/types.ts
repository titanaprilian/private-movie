export interface ParsedTitle {
  rawTitle: string;
  baseTitle: string;
  seasonNumber: number;
  year?: number;
}

export interface TmdbBaseSearchResult {
  id: number;
  name?: string;
  title?: string;
  original_name?: string;
  original_title?: string;
  first_air_date?: string;
  release_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  genre_ids?: number[];
}

export interface TmdbTvSearchResult extends TmdbBaseSearchResult {
  name: string;
  original_name: string;
}

export interface TmdbMovieSearchResult extends TmdbBaseSearchResult {
  title: string;
  original_title: string;
}

export interface TmdbSeasonInfo {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  episode_count: number;
  air_date?: string | null;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbTvDetails {
  id: number;
  name: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average?: number;
  genres?: TmdbGenre[];
  seasons?: TmdbSeasonInfo[];
}

export interface TmdbMovieDetails {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
}

export interface MatchOptions {
  year?: number;
  confidenceThreshold?: number;
}

export interface MatchResult<T = TmdbBaseSearchResult> {
  result: T;
  score: number;
}
