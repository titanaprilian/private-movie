import type { TmdbTvDetails, TmdbTvSearchResult } from "../../src/tmdb/types";

export const mockAharenSearchResults: TmdbTvSearchResult[] = [
  {
    id: 121544,
    name: "Aharen-san wa Hakarenai",
    original_name: "阿波連さんははかれない",
    first_air_date: "2022-04-02",
    overview:
      "Reina Aharen, a small and cute student with a quiet voice, is terrible at determining distance and space.",
    poster_path: "/aharen_main_poster.jpg",
    backdrop_path: "/aharen_backdrop.jpg",
    vote_average: 7.8,
  },
  {
    id: 999999,
    name: "Unrelated Show",
    original_name: "Unrelated Show",
    first_air_date: "2020-01-01",
    overview: "Some completely different show.",
    poster_path: "/unrelated.jpg",
    backdrop_path: "/unrelated_bg.jpg",
    vote_average: 5.0,
  },
];

export const mockAharenTvDetails: TmdbTvDetails = {
  id: 121544,
  name: "Aharen-san wa Hakarenai",
  original_name: "阿波連さんははかれない",
  overview:
    "Reina Aharen, a small and cute student with a quiet voice, is terrible at determining distance and space.",
  poster_path: "/aharen_main_poster.jpg",
  backdrop_path: "/aharen_backdrop.jpg",
  vote_average: 7.8,
  seasons: [
    {
      id: 1000,
      name: "Specials",
      overview: "Special episodes",
      poster_path: "/aharen_s0_poster.jpg",
      season_number: 0,
      episode_count: 2,
      air_date: "2022-03-01",
    },
    {
      id: 1001,
      name: "Season 1",
      overview: "First season of Aharen-san",
      poster_path: "/aharen_s1_poster.jpg",
      season_number: 1,
      episode_count: 12,
      air_date: "2022-04-02",
    },
    {
      id: 1002,
      name: "Season 2",
      overview: "Second season of Aharen-san",
      poster_path: "/aharen_s2_poster.jpg",
      season_number: 2,
      episode_count: 12,
      air_date: "2025-04-01",
    },
  ],
};
