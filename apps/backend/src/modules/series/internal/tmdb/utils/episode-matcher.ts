import type { ScrapedBulkEpisodeItem } from "../types";

export function stripSeasonDescriptors(title: string): string {
  let out = title;
  out = out.replace(/\b\d+(?:st|nd|rd|th)\s+season\b/gi, " ");
  out = out.replace(
    /\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+seasons?\b/gi,
    " "
  );
  out = out.replace(/\bseasons?\s+\d+\b/gi, " ");
  out = out.replace(/\bseasons?\s+[IVXLCDM]+\b/gi, " ");
  out = out.replace(/\b(?:part|cour)\s+(?:\d+|[IVXLCDM]+)\b/gi, " ");
  out = out.replace(/\b[IVXLCDM]{2,}\b/g, " ");
  return out.replace(/\s{2,}/g, " ").trim();
}

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

export interface ScrapedEpisodeInput {
  title: string;
  url: string;
}

export function matchScrapedEpisodes(
  scraped: ScrapedEpisodeInput[],
  localOrders: Map<number, string>,
  offset = 0
): ScrapedBulkEpisodeItem[] {
  return scraped.map((scrapedEp) => {
    const epNum = parseBulkScrapedEpisodeNumber(scrapedEp.title);
    let calculatedOrder: number | null = null;
    let matchedLocalEpisodeId: string | null = null;
    let matchStatus: "matched" | "unmatched" = "unmatched";

    if (epNum !== null && Number.isInteger(epNum)) {
      const targetOrder = epNum + offset;
      calculatedOrder = targetOrder;
      const matchedId = localOrders.get(targetOrder);
      if (matchedId) {
        matchedLocalEpisodeId = matchedId;
        matchStatus = "matched";
      }
    }

    return {
      scrapedTitle: scrapedEp.title,
      scrapedUrl: scrapedEp.url,
      episodeNumber: epNum,
      calculatedOrder,
      matchedLocalEpisodeId,
      matchStatus,
    };
  });
}
