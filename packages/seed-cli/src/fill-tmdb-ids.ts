import fs from "node:fs";
import path from "node:path";
import {
  parseLocalTitle,
  findBestMatch,
  type TmdbTvSearchResult,
  type TmdbMovieSearchResult,
} from "@repo/db";
import { DEFAULT_TMDB_IDS_PATH } from "./seed-tmdb";

export interface TmdbFileEntry {
  rawTitle: string;
  lineIndex: number;
  hasId: boolean;
  isUnmatched: boolean;
  existingId?: number;
}

export interface ParseFileResult {
  lines: string[];
  entries: TmdbFileEntry[];
  pendingEntries: TmdbFileEntry[];
}

export interface TmdbMatchResult {
  id: number;
  score: number;
  type: "tv" | "movie";
}

export interface FillTmdbIdsOptions {
  idsFilePath?: string;
  token?: string;
  batchSize?: number;
  confidenceThreshold?: number;
  fetchFn?: (url: string, init?: RequestInit) => Promise<any>;
  logFn?: (message: string) => void;
  sleepFn?: (ms: number) => Promise<void>;
  onBatchProcessed?: (processedCount: number, totalPending: number) => Promise<void> | void;
}

export interface FillTmdbIdsSummary {
  totalEntries: number;
  skippedEntries: number;
  pendingEntries: number;
  matchedTvCount: number;
  matchedMovieCount: number;
  unmatchedCount: number;
}

export function parseTmdbFileContent(content: string): ParseFileResult {
  const lines = content.split(/\r?\n/);
  const entries: TmdbFileEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("#")) {
      if (/^#\s*(?:TMDB TV Series IDs|One TMDB ID)/i.test(trimmed)) {
        continue;
      }

      const isUnmatched = /\[UNMATCHED\]/i.test(trimmed);
      const rawTitle = trimmed
        .replace(/^#\s*/, "")
        .replace(/\[UNMATCHED\]/gi, "")
        .trim();

      if (!rawTitle) continue;

      let hasId = false;
      let existingId: number | undefined;

      for (let j = i + 1; j < lines.length; j++) {
        const nextTrimmed = lines[j].trim();
        if (!nextTrimmed) continue;
        if (nextTrimmed.startsWith("#")) break;

        const parsedId = parseInt(nextTrimmed, 10);
        if (!isNaN(parsedId) && /^\d+$/.test(nextTrimmed)) {
          hasId = true;
          existingId = parsedId;
        }
        break;
      }

      entries.push({
        rawTitle,
        lineIndex: i,
        hasId,
        isUnmatched,
        ...(existingId !== undefined ? { existingId } : {}),
      });
    }
  }

  const pendingEntries = entries.filter((e) => !e.hasId && !e.isUnmatched);

  return { lines, entries, pendingEntries };
}

export async function findTmdbMatchForTitle(
  rawTitle: string,
  options: {
    token?: string;
    confidenceThreshold?: number;
    fetchFn?: (url: string, init?: RequestInit) => Promise<any>;
    logFn?: (message: string) => void;
    sleepFn?: (ms: number) => Promise<void>;
  } = {}
): Promise<TmdbMatchResult | null> {
  const log = options.logFn ?? console.log;
  const sleepFn = options.sleepFn ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const threshold = options.confidenceThreshold ?? 0.8;
  const token = options.token ?? process.env.TMDB_TOKEN ?? process.env.TMDB_API_KEY;

  const rawFetchFn = options.fetchFn ?? ((url: string, init?: RequestInit) => fetch(url, init));

  const fetchFnWithRetry = async (url: string, init?: RequestInit, retryCount = 0): Promise<any> => {
    const res = await rawFetchFn(url, init);

    if (res && typeof res === "object" && "status" in res && res.status === 429) {
      if (retryCount >= 5) {
        throw new Error(`TMDB rate limit exceeded after 5 retries: ${url}`);
      }
      const retryAfter = res.headers
        ? typeof res.headers.get === "function"
          ? res.headers.get("retry-after")
          : res.headers["retry-after"]
        : null;
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000;
      log(`TMDB rate limit hit (429). Retrying in ${waitMs}ms...`);
      await sleepFn(waitMs);
      return fetchFnWithRetry(url, init, retryCount + 1);
    }

    if (res && typeof res === "object" && "json" in res && typeof res.json === "function") {
      if ("ok" in res && !res.ok) {
        throw new Error(`TMDB API Error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    }

    return res;
  };

  const headers: Record<string, string> = { accept: "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const parsed = parseLocalTitle(rawTitle);

  // 1. Search TV Endpoint
  const tvUrl = `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(parsed.baseTitle)}&language=en-US`;
  try {
    const tvData = await fetchFnWithRetry(tvUrl, { headers });
    const tvResults: TmdbTvSearchResult[] = Array.isArray(tvData?.results) ? tvData.results : [];
    const tvMatch = findBestMatch(parsed.baseTitle, tvResults, {
      confidenceThreshold: threshold,
      year: parsed.year,
    });

    if (tvMatch && tvMatch.score >= threshold) {
      return { id: tvMatch.result.id, score: tvMatch.score, type: "tv" };
    }
  } catch (err) {
    log(`TV search error for "${parsed.baseTitle}": ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Fallback to Movie Endpoint
  const movieUrl = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(parsed.baseTitle)}&language=en-US`;
  try {
    const movieData = await fetchFnWithRetry(movieUrl, { headers });
    const movieResults: TmdbMovieSearchResult[] = Array.isArray(movieData?.results) ? movieData.results : [];
    const movieMatch = findBestMatch(parsed.baseTitle, movieResults, {
      confidenceThreshold: threshold,
      year: parsed.year,
    });

    if (movieMatch && movieMatch.score >= threshold) {
      return { id: movieMatch.result.id, score: movieMatch.score, type: "movie" };
    }
  } catch (err) {
    log(`Movie search error for "${parsed.baseTitle}": ${err instanceof Error ? err.message : String(err)}`);
  }

  return null;
}

export function reconstructFileContent(
  lines: string[],
  batchResults: Array<{ entry: TmdbFileEntry; match: TmdbMatchResult | null }>
): string {
  const resultMap = new Map<number, { entry: TmdbFileEntry; match: TmdbMatchResult | null }>();
  for (const item of batchResults) {
    resultMap.set(item.entry.lineIndex, item);
  }

  const newLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (resultMap.has(i)) {
      const { entry, match } = resultMap.get(i)!;
      if (match) {
        newLines.push(`# ${entry.rawTitle}`);
        newLines.push(String(match.id));
      } else {
        newLines.push(`# ${entry.rawTitle} [UNMATCHED]`);
      }
    } else {
      newLines.push(lines[i]);
    }
  }

  return newLines.join("\n");
}

export async function fillTmdbIds(options: FillTmdbIdsOptions = {}): Promise<FillTmdbIdsSummary> {
  const log = options.logFn ?? console.log;
  const sleepFn = options.sleepFn ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const batchSize = options.batchSize ?? 20;
  const threshold = options.confidenceThreshold ?? 0.8;
  const idsFilePath = options.idsFilePath ?? DEFAULT_TMDB_IDS_PATH;

  const token = options.token ?? process.env.TMDB_TOKEN ?? process.env.TMDB_API_KEY;
  if (!token && !options.fetchFn) {
    throw new Error("Missing TMDB_TOKEN environment variable");
  }

  if (!fs.existsSync(idsFilePath)) {
    throw new Error(`TMDB IDs file not found at ${idsFilePath}`);
  }

  const initialContent = fs.readFileSync(idsFilePath, "utf-8");
  const { lines, entries, pendingEntries } = parseTmdbFileContent(initialContent);

  log(`Loaded file: ${idsFilePath}`);
  log(`Total title entries: ${entries.length}`);
  log(`Skipped (already filled/unmatched): ${entries.length - pendingEntries.length}`);
  log(`Pending entries to process: ${pendingEntries.length}`);

  let matchedTvCount = 0;
  let matchedMovieCount = 0;
  let unmatchedCount = 0;

  const accumulatedResults: Array<{ entry: TmdbFileEntry; match: TmdbMatchResult | null }> = [];
  const totalPending = pendingEntries.length;

  for (let i = 0; i < pendingEntries.length; i += batchSize) {
    const batch = pendingEntries.slice(i, i + batchSize);
    log(`\nProcessing batch [${i + 1}-${Math.min(i + batchSize, totalPending)} of ${totalPending}]...`);

    const batchResults = await Promise.all(
      batch.map(async (entry) => {
        log(` Searching: "${entry.rawTitle}"`);
        const match = await findTmdbMatchForTitle(entry.rawTitle, {
          token,
          confidenceThreshold: threshold,
          fetchFn: options.fetchFn,
          logFn: log,
          sleepFn,
        });

        if (match) {
          if (match.type === "tv") matchedTvCount++;
          else matchedMovieCount++;
          log(`  -> Matched (${match.type.toUpperCase()}) ID ${match.id} (Score: ${match.score.toFixed(2)})`);
        } else {
          unmatchedCount++;
          log(`  -> No match >= ${threshold} for "${entry.rawTitle}" -> Tagged [UNMATCHED]`);
        }

        return { entry, match };
      })
    );

    accumulatedResults.push(...batchResults);
    const updatedContent = reconstructFileContent(lines, accumulatedResults);
    fs.writeFileSync(idsFilePath, updatedContent, "utf-8");

    if (options.onBatchProcessed) {
      await options.onBatchProcessed(Math.min(i + batchSize, totalPending), totalPending);
    }
  }

  log("\n==================================================");
  log("TMDB ID FILL PIPELINE SUMMARY");
  log("==================================================");
  log(`Total Entries      : ${entries.length}`);
  log(`Skipped Entries    : ${entries.length - pendingEntries.length}`);
  log(`Pending Processed  : ${pendingEntries.length}`);
  log(`Matched TV Shows   : ${matchedTvCount}`);
  log(`Matched Movies     : ${matchedMovieCount}`);
  log(`Unmatched Tagged   : ${unmatchedCount}`);
  log("==================================================\n");

  return {
    totalEntries: entries.length,
    skippedEntries: entries.length - pendingEntries.length,
    pendingEntries: pendingEntries.length,
    matchedTvCount,
    matchedMovieCount,
    unmatchedCount,
  };
}

if (import.meta.main) {
  fillTmdbIds().catch((err) => {
    console.error("Fatal error during TMDB ID filling pipeline:", err);
    process.exit(1);
  });
}
