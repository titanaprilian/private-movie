import { randomUUID } from "node:crypto";
import type { NewGenreRow, NewSeriesRow } from "../schema/media";
import { slugifyGenre } from "../migrate-genres";
import type { ParsedTitle, TmdbTvDetails } from "./types";

const ABBREVIATIONS: Record<string, string> = {
  "danmachi": "Dungeon ni Deai wo Motomeru no wa Machigatteiru Darou ka",
  "sbdwk": "Sono Bisque Doll wa Koi wo Suru",
  "jjk": "Jujutsu Kaisen",
};

export function parseLocalTitle(rawTitle: string): ParsedTitle {
  let title = rawTitle.trim();
  let seasonNumber = 1;
  let year: number | undefined;

  // Extract year e.g. "(2011)" or trailing/standalone "2011"
  const yearMatch = title.match(/(?:\(|\b)(19\d\d|20\d\d)(?:\)|\b)/);
  if (yearMatch) {
    year = Number.parseInt(yearMatch[1], 10);
    title = title.replace(yearMatch[0], "").trim();
  }

  // Strip brackets like (Episod 1 - 12) or [Subs]
  title = title.replace(/[\(\[].*?(?:episod|sub).*?[\)\]]/ig, "");

  // Check for Specials / OVA / OAV
  const specialMatch = title.match(/\b(ova|oav|specials?)\b/i);
  if (specialMatch) {
    seasonNumber = 0;
    title = title.replace(specialMatch[0], "").trim();
  } else {
    // Check for "Season X" or "Part X"
    const seasonWordMatch = title.match(/\b(?:season|part)\s*(\d+)\b/i);
    if (seasonWordMatch) {
      seasonNumber = Number.parseInt(seasonWordMatch[1], 10);
      title = title.replace(seasonWordMatch[0], "").trim();
    } else {
      // Check for ordinal season e.g. "2nd Season"
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

  // Strip arbitrary scraper tags (BD, TV, Uncensored, UNC, Summary) and literal "+"
  title = title.replace(/\b(bd|tv|uncensored|unc|summary)\b/ig, "");
  title = title.replace(/\+/g, "").trim();

  // Clean trailing punctuation or delimiters like dashes or colons
  let baseTitle = title
    .replace(/[-:]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  // Expand notorious abbreviations
  for (const [abbr, fullName] of Object.entries(ABBREVIATIONS)) {
    const abbrRegex = new RegExp(`^${abbr}$`, "i");
    if (abbrRegex.test(baseTitle)) {
      baseTitle = fullName;
      break; // Only expand once
    } else {
      // Also expand if it's the very first word (e.g. Danmachi Gaiden)
      const prefixRegex = new RegExp(`^${abbr}\\b`, "i");
      if (prefixRegex.test(baseTitle)) {
        baseTitle = baseTitle.replace(prefixRegex, fullName);
        break;
      }
    }
  }

  return {
    rawTitle,
    baseTitle: baseTitle || rawTitle,
    seasonNumber,
    ...(year ? { year } : {}),
  };
}

export interface MapSeriesOptions {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function mapTmdbTvToSeriesRow(
  details: TmdbTvDetails,
  options?: MapSeriesOptions
): NewSeriesRow {
  const now = new Date();
  return {
    id: options?.id ?? randomUUID(),
    title: details.name,
    description: details.overview || null,
    type: "tv",
    posterUrl: details.poster_path || null,
    backdropUrl: details.backdrop_path || null,
    rating:
      details.vote_average !== undefined && details.vote_average !== null
        ? String(details.vote_average)
        : null,
    tmdbId: details.id,
    tmdbSyncStatus: "SYNCED",
    createdAt: options?.createdAt ?? now,
    updatedAt: options?.updatedAt ?? now,
  };
}

export function extractTmdbGenres(details: TmdbTvDetails): NewGenreRow[] {
  if (!details.genres || !Array.isArray(details.genres)) {
    return [];
  }

  return details.genres
    .filter((g) => g.name && g.name.trim().length > 0)
    .map((g) => {
      const name = g.name.trim();
      const slug = slugifyGenre(name);
      return {
        id: randomUUID(),
        name,
        slug,
      };
    });
}

export interface ParsedTmdbTvResult {
  series: NewSeriesRow;
  genres: NewGenreRow[];
}

export function parseTmdbTvDetails(
  details: TmdbTvDetails,
  options?: MapSeriesOptions
): ParsedTmdbTvResult {
  return {
    series: mapTmdbTvToSeriesRow(details, options),
    genres: extractTmdbGenres(details),
  };
}

