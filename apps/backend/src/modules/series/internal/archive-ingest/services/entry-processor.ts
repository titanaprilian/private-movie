import { basename } from "node:path";
import type { ArchiveIngestJobEntryRow } from "@repo/db";
import {
  detectEpisodeNumber,
  detectQuality,
  isSampleFile,
  isVideoFile,
} from "../../../../episodes";
import type { ArchiveEntry } from "./extractor";

export const SIBLING_SIZE_DISPARITY_THRESHOLD = 0.5; // Flag if size differs by >50% from median

/**
 * Pure archive entry analysis: filters valid videos, computes median sibling
 * size, flags size disparity, and flags episode number collisions.
 * No database, network, or filesystem access; no instance state.
 */
export function processArchiveEntries(
  entries: ArchiveEntry[],
): ArchiveIngestJobEntryRow[] {
  // 1. Filter out directories, non-videos, and sample files
  const validVideoEntries = entries.filter(
    (entry) =>
      !entry.isDirectory &&
      isVideoFile(entry.path) &&
      !isSampleFile(entry.path),
  );

  if (validVideoEntries.length === 0) {
    return [];
  }

  // 2. Calculate median size across all valid sibling video files for disparity detection
  const validSizes = validVideoEntries
    .map((e) => e.sizeBytes)
    .filter((sz) => sz > 0)
    .sort((a, b) => a - b);

  let medianSize: number | null = null;
  if (validSizes.length > 0) {
    const mid = Math.floor(validSizes.length / 2);
    medianSize =
      validSizes.length % 2 !== 0
        ? validSizes[mid]!
        : Math.round((validSizes[mid - 1]! + validSizes[mid]!) / 2);
  }

  // 3. Match episode numbers, quality, and check sibling size disparity
  const matchedList: ArchiveIngestJobEntryRow[] = validVideoEntries.map(
    (entry) => {
      const filename = basename(entry.path);
      const detectedEpisodeNumber = detectEpisodeNumber(filename);
      const quality = detectQuality(filename);

      let needsReview = false;

      // Flag if detected episode number is missing
      if (detectedEpisodeNumber === null) {
        needsReview = true;
      }

      // Sibling size disparity: flag unusually small videos (< 50% of median size)
      if (medianSize !== null && medianSize > 0 && entry.sizeBytes > 0) {
        if (
          entry.sizeBytes <
          medianSize * (1 - SIBLING_SIZE_DISPARITY_THRESHOLD)
        ) {
          needsReview = true;
        }
      }

      return {
        filename: entry.path,
        sizeBytes: entry.sizeBytes,
        detectedEpisodeNumber,
        quality,
        needsReview,
      };
    },
  );

  // 4. Flag collision: multiple files detecting the same episode number
  const counts = new Map<number, number>();
  for (const item of matchedList) {
    if (
      item.detectedEpisodeNumber !== null &&
      item.detectedEpisodeNumber !== undefined
    ) {
      counts.set(
        item.detectedEpisodeNumber,
        (counts.get(item.detectedEpisodeNumber) ?? 0) + 1,
      );
    }
  }

  for (const item of matchedList) {
    if (
      item.detectedEpisodeNumber !== null &&
      item.detectedEpisodeNumber !== undefined &&
      (counts.get(item.detectedEpisodeNumber) ?? 0) > 1
    ) {
      item.needsReview = true;
    }
  }

  return matchedList;
}
