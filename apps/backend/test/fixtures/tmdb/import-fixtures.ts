import { vi } from "vitest";

export const MOCK_TMDB_TV_SHOW = {
  id: 100,
  name: "Breaking Code",
  overview: "A developer decides to write flawless tests.",
  poster_path: "/breaking_code_poster.jpg",
  backdrop_path: "/breaking_code_backdrop.jpg",
  first_air_date: "2024-01-01",
  vote_average: 9.3,
  genres: [
    { id: 18, name: "Drama" },
    { id: 80, name: "Crime" },
  ],
  seasons: [
    {
      season_number: 1,
      name: "Season 1",
      poster_path: "/s1_poster.jpg",
      overview: "The initial release.",
      air_date: "2024-01-01",
      episode_count: 2,
    },
  ],
};

export const MOCK_TMDB_TV_SEASON_1 = {
  id: 1001,
  season_number: 1,
  name: "Season 1",
  overview: "The initial release.",
  poster_path: "/s1_poster.jpg",
  air_date: "2024-01-01",
  episodes: [
    {
      id: 10001,
      episode_number: 1,
      name: "Hello World",
      overview: "Setting up the development environment.",
      still_path: "/ep1_still.jpg",
      air_date: "2024-01-01",
      vote_average: 8.8,
      runtime: 45,
    },
    {
      id: 10002,
      episode_number: 2,
      name: "Red-Green-Refactor",
      overview: "Writing tests first.",
      still_path: "/ep2_still.jpg",
      air_date: "2024-01-08",
      vote_average: 9.1,
      runtime: 50,
    },
  ],
};

export const MOCK_TMDB_TV_UPDATED = {
  ...MOCK_TMDB_TV_SHOW,
  overview: "Updated overview: tests are now 100% integration-backed.",
  vote_average: 9.7,
};

export const MOCK_TMDB_MOVIE = {
  id: 500,
  title: "Integration: The Movie",
  overview: "Real databases, real queries, zero mocks.",
  poster_path: "/movie_poster.jpg",
  backdrop_path: "/movie_backdrop.jpg",
  release_date: "2025-06-01",
  vote_average: 8.9,
  runtime: 120,
  genres: [
    { id: 878, name: "Sci-Fi" },
    { id: 53, name: "Thriller" },
  ],
};

export const MOCK_TMDB_TV_IMAGES = {
  id: 100,
  logos: [
    {
      file_path: "/tv_logo_en.png",
      iso_639_1: "en",
      vote_average: 5.5,
    },
  ],
};

export const MOCK_TMDB_MOVIE_IMAGES = {
  id: 500,
  logos: [
    {
      file_path: "/movie_logo_en.png",
      iso_639_1: "en",
      vote_average: 5.2,
    },
  ],
};

export interface SetupTmdbFetchMockOptions {
  tvShow?: typeof MOCK_TMDB_TV_SHOW;
  tvSeason1?: typeof MOCK_TMDB_TV_SEASON_1;
  movie?: typeof MOCK_TMDB_MOVIE;
  tvImages?: typeof MOCK_TMDB_TV_IMAGES;
  movieImages?: typeof MOCK_TMDB_MOVIE_IMAGES;
}

export function setupTmdbFetchMock(options: SetupTmdbFetchMockOptions = {}) {
  const tvShow = options.tvShow ?? MOCK_TMDB_TV_SHOW;
  const tvSeason1 = options.tvSeason1 ?? MOCK_TMDB_TV_SEASON_1;
  const movie = options.movie ?? MOCK_TMDB_MOVIE;
  const tvImages = options.tvImages ?? MOCK_TMDB_TV_IMAGES;
  const movieImages = options.movieImages ?? MOCK_TMDB_MOVIE_IMAGES;

  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = input.toString();

    // 404 for nonexistent IDs
    if (url.includes("/999999")) {
      return new Response(
        JSON.stringify({ status_message: "The resource you requested could not be found." }),
        { status: 404 }
      );
    }

    // TV Season 1 details
    if (url.includes(`/tv/${tvShow.id}/season/1`)) {
      return new Response(JSON.stringify(tvSeason1), { status: 200 });
    }

    // TV Images
    if (url.includes(`/tv/${tvShow.id}/images`)) {
      return new Response(JSON.stringify(tvImages), { status: 200 });
    }

    // TV Show details
    if (url.includes(`/tv/${tvShow.id}`)) {
      return new Response(JSON.stringify(tvShow), { status: 200 });
    }

    // Movie Images
    if (url.includes(`/movie/${movie.id}/images`)) {
      return new Response(JSON.stringify(movieImages), { status: 200 });
    }

    // Movie details
    if (url.includes(`/movie/${movie.id}`)) {
      return new Response(JSON.stringify(movie), { status: 200 });
    }

    throw new Error(`Unhandled TMDB mock fetch URL: ${url}`);
  });
}
