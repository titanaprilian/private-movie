export interface SequentialFallbackTarget {
  id: string;
  order: number;
}

export interface SequentialFallbackItem {
  episodeNumber: number | null;
  calculatedOrder: number | null;
  matchedLocalEpisodeId: string | null;
  matchStatus: "matched" | "unmatched";
}

/**
 * Sequential fallback: scraped episodes with an integer episode number that
 * title matching left unmatched default to the next unclaimed target-season
 * episode in order. Non-integer (decimals/specials) and excess items stay
 * unmapped so they keep needing review.
 */
export function applySequentialFallback<T extends SequentialFallbackItem>(
  scrapedItems: T[],
  targets: SequentialFallbackTarget[]
): T[] {
  const sortedTargets = [...targets].sort((a, b) => a.order - b.order);
  const claimed = new Set<string>();
  for (const item of scrapedItems) {
    if (item.matchedLocalEpisodeId) claimed.add(item.matchedLocalEpisodeId);
  }
  let cursor = 0;
  return scrapedItems.map((item) => {
    if (
      item.matchedLocalEpisodeId ||
      item.episodeNumber === null ||
      !Number.isInteger(item.episodeNumber)
    ) {
      return item;
    }
    while (cursor < sortedTargets.length && claimed.has(sortedTargets[cursor].id)) {
      cursor++;
    }
    const target = sortedTargets[cursor];
    if (!target) return item;
    claimed.add(target.id);
    cursor++;
    return {
      ...item,
      calculatedOrder: target.order,
      matchedLocalEpisodeId: target.id,
      matchStatus: "matched" as const,
    };
  });
}
