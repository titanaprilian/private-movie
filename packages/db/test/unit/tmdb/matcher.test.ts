import { describe, expect, it } from "vitest";
import { mockAharenSearchResults, mockAharenTvDetails } from "../../fixtures/aharen-san";
import { findBestMatch, findMatchingSeason } from "../../../src/tmdb/matcher";

describe("findBestMatch (Confident Match Algorithm)", () => {
  it("confidently matches local base title against TMDB search results", () => {
    const match = findBestMatch("Aharen-san", mockAharenSearchResults);
    expect(match).not.toBeNull();
    expect(match?.result.id).toBe(121544);
    expect(match?.result.name).toBe("Aharen-san wa Hakarenai");
    expect(match?.score).toBeGreaterThan(0.5);
  });

  it("confidently matches full Japanese title 'Aharen-san wa Hakarenai'", () => {
    const match = findBestMatch("Aharen-san wa Hakarenai", mockAharenSearchResults);
    expect(match).not.toBeNull();
    expect(match?.result.id).toBe(121544);
  });

  it("disambiguates remakes based on year when specified", () => {
    const remakesList = [
      {
        id: 100,
        name: "Hunter x Hunter",
        original_name: "HUNTER×HUNTER",
        first_air_date: "1999-10-16",
      },
      {
        id: 200,
        name: "Hunter x Hunter",
        original_name: "HUNTER×HUNTER",
        first_air_date: "2011-10-02",
      },
    ];

    const match2011 = findBestMatch("Hunter x Hunter", remakesList, { year: 2011 });
    expect(match2011?.result.id).toBe(200);

    const match1999 = findBestMatch("Hunter x Hunter", remakesList, { year: 1999 });
    expect(match1999?.result.id).toBe(100);
  });

  it("returns null if no search result passes the confidence threshold", () => {
    const match = findBestMatch("Completely Unrelated Anime Title XYZ", mockAharenSearchResults);
    expect(match).toBeNull();
  });

  it("prioritizes candidate with Animation genre (id 16)", () => {
    const list = [
      {
        id: 1,
        name: "Kanojo, Okarishimasu",
        original_name: "Kanojo, Okarishimasu",
        genre_ids: [18, 35],
      },
      {
        id: 2,
        name: "Kanojo, Okarishimasu",
        original_name: "Kanojo, Okarishimasu",
        genre_ids: [16, 35],
      },
    ];

    const match = findBestMatch("Kanojo, Okarishimasu", list);
    expect(match?.result.id).toBe(2);
    // Both have exact name match (1.0).
    // id 1: 1.0 - 0.2 = 0.8
    // id 2: 1.0 + 0.3 = 1.3
  });
});

describe("findMatchingSeason", () => {
  it("extracts season 2 details from mocked Aharen-san payload", () => {
    const season = findMatchingSeason(mockAharenTvDetails, 2);
    expect(season).not.toBeNull();
    expect(season?.season_number).toBe(2);
    expect(season?.name).toBe("Season 2");
    expect(season?.poster_path).toBe("/aharen_s2_poster.jpg");
  });

  it("extracts season 0 (Specials) details from mocked payload", () => {
    const season = findMatchingSeason(mockAharenTvDetails, 0);
    expect(season).not.toBeNull();
    expect(season?.season_number).toBe(0);
    expect(season?.poster_path).toBe("/aharen_s0_poster.jpg");
  });

  it("returns null if the requested season number does not exist", () => {
    const season = findMatchingSeason(mockAharenTvDetails, 99);
    expect(season).toBeNull();
  });
});
