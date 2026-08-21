import { describe, expect, it } from "vitest";
import { parseLocalTitle } from "../../../src/tmdb/parser";

describe("parseLocalTitle", () => {
  it("extracts base title and season number for 'Season X' format", () => {
    const result = parseLocalTitle("Aharen-san Season 2");
    expect(result).toEqual({
      rawTitle: "Aharen-san Season 2",
      baseTitle: "Aharen-san",
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

    const resultS02 = parseLocalTitle("Aharen-san S02");
    expect(resultS02).toEqual({
      rawTitle: "Aharen-san S02",
      baseTitle: "Aharen-san",
      seasonNumber: 2,
    });
  });

  it("extracts base title and season number for ordinal formats ('2nd Season')", () => {
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

    const resultSpecial = parseLocalTitle("Aharen-san Special");
    expect(resultSpecial).toEqual({
      rawTitle: "Aharen-san Special",
      baseTitle: "Aharen-san",
      seasonNumber: 0,
    });
  });

  it("extracts year when specified in parentheses or trailing 4-digit number", () => {
    const result = parseLocalTitle("Hunter x Hunter (2011)");
    expect(result).toEqual({
      rawTitle: "Hunter x Hunter (2011)",
      baseTitle: "Hunter x Hunter",
      seasonNumber: 1,
      year: 2011,
    });
  });

  it("defaults season to 1 when no season indicator is present", () => {
    const result = parseLocalTitle("Aharen-san wa Hakarenai");
    expect(result).toEqual({
      rawTitle: "Aharen-san wa Hakarenai",
      baseTitle: "Aharen-san wa Hakarenai",
      seasonNumber: 1,
    });
  });
});
