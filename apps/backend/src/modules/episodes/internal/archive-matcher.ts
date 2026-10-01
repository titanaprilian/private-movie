import type { ArchiveStagedFileItem } from "@repo/contracts";

export const VIDEO_EXTENSIONS = [".mp4", ".mkv", ".avi", ".webm", ".mov", ".ts"] as const;

export function isVideoFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isSampleFile(filename: string): boolean {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  return /(^|[\s._\-()[\]])sample(s)?($|[\s._\-()[\]])/i.test(base);
}

export interface StagedFileEntry {
  fileId: string;
  filename: string;
  fileSizeBytes: number;
}

export function filterStagedVideoFiles(files: StagedFileEntry[]): StagedFileEntry[] {
  return files.filter((f) => isVideoFile(f.filename) && !isSampleFile(f.filename));
}

const SEASON_EPISODE_PATTERN = /s\d{1,3}e(\d{1,4})/i;
const EP_WORD_PATTERN = /(?:^|[^a-zA-Z0-9])(?:ep|episode)[\s._-]*(\d{1,4})\b/i;
const EP_ATTACHED_PATTERN = /(?:^|[^a-zA-Z0-9])e(\d{1,4})\b/i;
// Bare-number fallback only accepts zero-padded or multi-digit tokens
// ("- 02", "[12]") so release years, quality tags, and phrases like
// "Volume 3" are never mistaken for episode numbers.
const BRACKET_DASH_PATTERN = /(?:^|[\s\-_[(])(0\d{1,2}|[1-9]\d{1,2})(?=$|[\s\-_\].) \]])/;

function digitRunQualityGuard(filename: string, matchIndex: number, matchLength: number): boolean {
  const before = filename[matchIndex - 1];
  const after = filename[matchIndex + matchLength];
  if (before !== undefined && /\d/.test(before)) return false;
  if (after !== undefined && (/\d/.test(after) || after === "p" || after === "P")) return false;
  return true;
}

export function detectEpisodeNumber(filename: string): number | null {
  const base = filename.split(/[\\/]/).pop() ?? filename;

  const se = SEASON_EPISODE_PATTERN.exec(base);
  if (se?.[1]) {
    const n = parseInt(se[1], 10);
    if (!Number.isNaN(n)) return n;
  }

  const ep = EP_WORD_PATTERN.exec(base) ?? EP_ATTACHED_PATTERN.exec(base);
  if (ep?.[1] && ep.index !== undefined) {
    const n = parseInt(ep[1], 10);
    if (!Number.isNaN(n) && digitRunQualityGuard(base, ep.index + ep[0].indexOf(ep[1]), ep[1].length)) {
      return n;
    }
  }

  const fallback = BRACKET_DASH_PATTERN.exec(base);
  if (fallback?.[1] && fallback.index !== undefined) {
    const n = parseInt(fallback[1], 10);
    if (!Number.isNaN(n) && n > 0) {
      const digitStart = fallback.index + fallback[0].indexOf(fallback[1]);
      if (digitRunQualityGuard(base, digitStart, fallback[1].length)) {
        return n;
      }
    }
  }

  return null;
}

const RESOLUTION_PATTERN = /(\d{3,4})[pP]\b/;
const ULTRA_HD_PATTERN = /\b(4k|uhd|2160p)\b/i;

export function detectQuality(filename: string): string | null {
  if (ULTRA_HD_PATTERN.test(filename)) return "2160p";
  const m = RESOLUTION_PATTERN.exec(filename);
  if (m?.[1]) return `${m[1]}p`;
  return null;
}

export interface MatchableEpisode {
  id: string;
  order?: number | null;
  tmdbEpisodeNumber?: number | null;
}

export function matchArchiveFilesToEpisodes(
  files: StagedFileEntry[],
  episodes: MatchableEpisode[]
): ArchiveStagedFileItem[] {
  const byNumber = new Map<number, string>();
  for (const ep of episodes) {
    const num = ep.order ?? ep.tmdbEpisodeNumber ?? null;
    if (num !== null && num !== undefined && !byNumber.has(num)) {
      byNumber.set(num, ep.id);
    }
  }

  const items: ArchiveStagedFileItem[] = files.map((f) => {
    const detectedEpisodeNumber = detectEpisodeNumber(f.filename);
    const matchedEpisodeId =
      detectedEpisodeNumber !== null ? (byNumber.get(detectedEpisodeNumber) ?? null) : null;
    return {
      fileId: f.fileId,
      filename: f.filename,
      fileSizeBytes: f.fileSizeBytes,
      detectedEpisodeNumber,
      matchedEpisodeId,
      quality: detectQuality(f.filename),
      needsReview: matchedEpisodeId === null,
    };
  });

  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.matchedEpisodeId) {
      counts.set(item.matchedEpisodeId, (counts.get(item.matchedEpisodeId) ?? 0) + 1);
    }
  }
  for (const item of items) {
    if (item.matchedEpisodeId && (counts.get(item.matchedEpisodeId) ?? 0) > 1) {
      item.needsReview = true;
    }
  }

  return items;
}
