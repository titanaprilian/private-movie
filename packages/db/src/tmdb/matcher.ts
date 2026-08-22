import type {
  MatchOptions,
  MatchResult,
  TmdbBaseSearchResult,
  TmdbSeasonInfo,
  TmdbTvDetails,
} from "./types";

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function calculateTitleSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1.0;

  // Character Levenshtein similarity
  const maxLen = Math.max(norm1.length, norm2.length);
  const dist = levenshteinDistance(norm1, norm2);
  const levSim = 1 - dist / maxLen;

  // Token Dice similarity
  const tokens1 = new Set(norm1.split(" "));
  const tokens2 = new Set(norm2.split(" "));
  let intersectionCount = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) {
      intersectionCount++;
    }
  }
  const diceSim = (2 * intersectionCount) / (tokens1.size + tokens2.size);

  // Containment score: if all tokens of smaller title are in larger title
  let containmentSim = 0;
  const smallerTokens = tokens1.size <= tokens2.size ? tokens1 : tokens2;
  const largerTokens = tokens1.size <= tokens2.size ? tokens2 : tokens1;
  let matches = 0;
  for (const t of smallerTokens) {
    if (largerTokens.has(t)) matches++;
  }
  if (smallerTokens.size > 0 && matches === smallerTokens.size) {
    containmentSim = 0.8;
  }

  return Math.max(levSim, diceSim, containmentSim);
}

export function findBestMatch<T extends TmdbBaseSearchResult>(
  localBaseTitle: string,
  candidates: T[],
  options: MatchOptions = {},
): MatchResult<T> | null {
  const threshold = options.confidenceThreshold ?? 0.5;
  let bestResult: T | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    const candidateName = candidate.title || candidate.name;
    const candidateOriginalName = candidate.original_title || candidate.original_name;

    const scoreName = candidateName ? calculateTitleSimilarity(localBaseTitle, candidateName) : 0;
    const scoreOrig = candidateOriginalName ? calculateTitleSimilarity(localBaseTitle, candidateOriginalName) : 0;

    let score = Math.max(scoreName, scoreOrig);

    const yearString = candidate.release_date || candidate.first_air_date;

    // Disambiguate with release year if present in options
    if (options.year && yearString) {
      const candidateYear = Number.parseInt(yearString.slice(0, 4), 10);
      if (!Number.isNaN(candidateYear)) {
        if (candidateYear === options.year) {
          score = Math.min(1.0, score + 0.25);
        } else {
          score = Math.max(0, score - 0.3);
        }
      }
    }

    // Animation genre priority
    if (candidate.genre_ids && candidate.genre_ids.includes(16)) {
      score += 0.3;
    } else {
      score -= 0.2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestResult = candidate;
    }
  }

  if (bestResult && bestScore >= threshold) {
    return { result: bestResult, score: bestScore };
  }

  return null;
}

export function findMatchingSeason(
  tvDetails: TmdbTvDetails,
  seasonNumber: number,
): TmdbSeasonInfo | null {
  const season = tvDetails.seasons?.find((s) => s.season_number === seasonNumber);
  return season ?? null;
}
