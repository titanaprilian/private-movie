import { stripSeasonDescriptors } from "./title";

export function parseBulkScrapedEpisodeNumber(title: string): number | null {
  const normalized = stripSeasonDescriptors(title);

  const decimalEpMatch = normalized.match(/(?:episode|eps|ep|#)\.?\s*(\d+\.\d+)/i);
  if (decimalEpMatch) {
    const num = parseFloat(decimalEpMatch[1]);
    if (!Number.isNaN(num)) return num;
  }

  const epMatch = normalized.match(/(?:episode|eps|ep|#)\.?\s*(\d+)/i);
  if (epMatch) {
    const num = parseInt(epMatch[1], 10);
    if (!Number.isNaN(num)) return num;
  }

  const titleWithoutSeason = normalized.replace(/\bseason\s*\d+/gi, "").replace(/\bs\d+\b/gi, "");

  const decimalMatch = titleWithoutSeason.match(/\b(\d+\.\d+)\b/);
  if (decimalMatch) {
    const num = parseFloat(decimalMatch[1]);
    if (!Number.isNaN(num)) return num;
  }

  const numMatch = titleWithoutSeason.match(/\b(\d+)\b/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (!Number.isNaN(num) && (num < 1900 || num > 2100)) return num;
  }

  return null;
}
