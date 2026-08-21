import type { ParsedTitle } from "./types";

export function parseLocalTitle(rawTitle: string): ParsedTitle {
  let title = rawTitle.trim();
  let seasonNumber = 1;
  let year: number | undefined;

  // Extract year e.g. "(2011)" or trailing/standalone "2011" or "1999"
  const yearMatch = title.match(/(?:\(|\b)(19\d\d|20\d\d)(?:\)|\b)/);
  if (yearMatch) {
    year = Number.parseInt(yearMatch[1], 10);
    // Clean year out of title
    title = title.replace(yearMatch[0], "").trim();
  }

  // Check for Specials / OVA / OAV
  const specialMatch = title.match(/\b(ova|oav|specials?)\b/i);
  if (specialMatch) {
    seasonNumber = 0;
    title = title.replace(specialMatch[0], "").trim();
  } else {
    // Check for "Season X" or "Season 0X"
    const seasonWordMatch = title.match(/\bseason\s*(\d+)\b/i);
    if (seasonWordMatch) {
      seasonNumber = Number.parseInt(seasonWordMatch[1], 10);
      title = title.replace(seasonWordMatch[0], "").trim();
    } else {
      // Check for ordinal season e.g. "2nd Season", "1st Season", "3rd Season"
      const ordinalSeasonMatch = title.match(/\b(\d+)(?:st|nd|rd|th)\s*season\b/i);
      if (ordinalSeasonMatch) {
        seasonNumber = Number.parseInt(ordinalSeasonMatch[1], 10);
        title = title.replace(ordinalSeasonMatch[0], "").trim();
      } else {
        // Check for "SX" or "S0X" pattern
        const sPatternMatch = title.match(/\bS(\d+)\b/i);
        if (sPatternMatch) {
          seasonNumber = Number.parseInt(sPatternMatch[1], 10);
          title = title.replace(sPatternMatch[0], "").trim();
        }
      }
    }
  }

  // Clean trailing punctuation or delimiters like dashes or colons
  const baseTitle = title
    .replace(/[-:]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    rawTitle,
    baseTitle: baseTitle || rawTitle,
    seasonNumber,
    ...(year ? { year } : {}),
  };
}
