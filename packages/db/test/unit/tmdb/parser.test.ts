import { describe, expect, it } from "vitest";
import { parseLocalTitle } from "../../../src/tmdb/parser";

describe("parseLocalTitle", () => {
  it("extracts base title and season number for 'Season X' or 'Part X' format", () => {
    const resultS = parseLocalTitle("Aharen-san Season 2");
    expect(resultS).toEqual({
      rawTitle: "Aharen-san Season 2",
      baseTitle: "Aharen-san",
      seasonNumber: 2,
    });

    const resultP = parseLocalTitle("NieR:Automata Ver1.1a Part 2");
    expect(resultP).toEqual({
      rawTitle: "NieR:Automata Ver1.1a Part 2",
      baseTitle: "NieR:Automata Ver1.1a",
      seasonNumber: 2,
    });
  });

  it("extracts base title and season number for 'Season 0X' format", () => {
    const result = parseLocalTitle("Aharen-san wa Hakarenai Season 02");
    expect(result).toEqual({
      rawTitle: "Aharen-san wa Hakarenai Season 02",
      baseTitle: "Aharen-san wa Hakarenai",
      seasonNumber: 2,
    });
  });

  it("extracts base title and season number for 'SX' or 'S0X' format", () => {
    const resultS2 = parseLocalTitle("Aharen-san S2");
    expect(resultS2).toEqual({
      rawTitle: "Aharen-san S2",
      baseTitle: "Aharen-san",
      seasonNumber: 2,
    });
  });

  it("extracts ordinal formats ('2nd Season')", () => {
    const result = parseLocalTitle("Aharen-san 2nd Season");
    expect(result).toEqual({
      rawTitle: "Aharen-san 2nd Season",
      baseTitle: "Aharen-san",
      seasonNumber: 2,
    });
  });

  it("extracts OVA and Special formats as season 0", () => {
    const resultOva = parseLocalTitle("Aharen-san OVA");
    expect(resultOva).toEqual({
      rawTitle: "Aharen-san OVA",
      baseTitle: "Aharen-san",
      seasonNumber: 0,
    });
  });

  it("extracts year when specified", () => {
    const result = parseLocalTitle("Hunter x Hunter (2011)");
    expect(result).toEqual({
      rawTitle: "Hunter x Hunter (2011)",
      baseTitle: "Hunter x Hunter",
      seasonNumber: 1,
      year: 2011,
    });
  });

  it("strips arbitrary scraper artifacts like BD, TV, and Uncensored", () => {
    const result = parseLocalTitle("AKB0048: Next Stage BD");
    expect(result).toEqual({
      rawTitle: "AKB0048: Next Stage BD",
      baseTitle: "AKB0048: Next Stage",
      seasonNumber: 1,
    });

    const result2 = parseLocalTitle("Some Anime TV Uncensored");
    expect(result2).toEqual({
      rawTitle: "Some Anime TV Uncensored",
      baseTitle: "Some Anime",
      seasonNumber: 1,
    });
  });
});
