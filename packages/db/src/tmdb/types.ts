export interface ParsedTitle {
  rawTitle: string;
  baseTitle: string;
  seasonNumber: number;
  year?: number;
}

export interface TmdbTvSearchResult {
  id: number;
  name: string;
  original_name: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  genre_ids?: number[];
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

export interface TmdbTvDetails {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  seasons: TmdbSeasonInfo[];
}

export interface MatchOptions {
  year?: number;
  confidenceThreshold?: number;
}

export interface MatchResult {
  result: TmdbTvSearchResult;
  score: number;
}
