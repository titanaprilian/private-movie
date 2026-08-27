import { useState, useCallback } from 'react';

export interface ScrapedEpisodePreviewItem {
  id: string;
  scrapedTitle: string;
  rawEpisodeNumber: number | string;
  calculatedOrder: number | null;
  matchedLocalEpisodeId: string | null;
  isIgnored: boolean;
  needsReview: boolean;
  videoSources: {
    type: string;
    url: string;
    label: string;
    quality?: string;
  }[];
}

export interface LocalEpisodeItem {
  id: string;
  title: string;
  order?: number;
  seasonId?: string | null;
  seasonTitle?: string;
  seasonNumber?: number;
}

export interface UseBulkScrapeSourcesOptions {
  initialSourceType?: string;
}

export function useBulkScrapeSources(options?: UseBulkScrapeSourcesOptions) {
  const [step, setStep] = useState<1 | 2>(1);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceType, setSourceType] = useState(options?.initialSourceType ?? 'otakudesu');
  const [episodeOffset, setEpisodeOffset] = useState(0);
  const [previewItems, setPreviewItems] = useState<ScrapedEpisodePreviewItem[]>([]);

  const fetchPreview = useCallback(
    (
      localEpisodes: LocalEpisodeItem[] = [],
      customItems?: Partial<ScrapedEpisodePreviewItem>[]
    ) => {
      const rawMockItems: Partial<ScrapedEpisodePreviewItem>[] = customItems ?? [
        {
          rawEpisodeNumber: 1,
          scrapedTitle: 'Episode 1',
          videoSources: [{ type: sourceType, url: `${sourceUrl}/ep-1`, label: 'Server 1', quality: '720p' }],
        },
        {
          rawEpisodeNumber: 2,
          scrapedTitle: 'Episode 2',
          videoSources: [{ type: sourceType, url: `${sourceUrl}/ep-2`, label: 'Server 1', quality: '720p' }],
        },
        {
          rawEpisodeNumber: 7.5,
          scrapedTitle: 'Episode 7.5 (Recap OVA)',
          videoSources: [{ type: sourceType, url: `${sourceUrl}/ep-7.5`, label: 'Server 1', quality: '720p' }],
        },
        {
          rawEpisodeNumber: 3,
          scrapedTitle: 'Episode 3',
          videoSources: [{ type: sourceType, url: `${sourceUrl}/ep-3`, label: 'Server 1', quality: '720p' }],
        },
      ];

      const processed: ScrapedEpisodePreviewItem[] = rawMockItems.map((item, idx) => {
        const rawNum = item.rawEpisodeNumber ?? idx + 1;
        const isNumInteger = typeof rawNum === 'number' ? Number.isInteger(rawNum) : /^\d+$/.test(String(rawNum).trim());
        const parsedInt = typeof rawNum === 'number' ? Math.floor(rawNum) : parseInt(String(rawNum), 10);

        let calculatedOrder: number | null = null;
        let matchedLocalEpisodeId: string | null = null;
        let needsReview = false;

        if (isNumInteger && !isNaN(parsedInt)) {
          calculatedOrder = parsedInt + episodeOffset;
          const match = localEpisodes.find((ep) => ep.order === calculatedOrder);
          if (match) {
            matchedLocalEpisodeId = match.id;
          } else {
            needsReview = true;
          }
        } else {
          // Decimal / non-integer episode e.g. 7.5
          calculatedOrder = null;
          matchedLocalEpisodeId = null;
          needsReview = true;
        }

        return {
          id: item.id ?? `scraped-${idx}-${Date.now()}`,
          scrapedTitle: item.scrapedTitle ?? `Episode ${rawNum}`,
          rawEpisodeNumber: rawNum,
          calculatedOrder,
          matchedLocalEpisodeId: item.matchedLocalEpisodeId ?? matchedLocalEpisodeId,
          isIgnored: item.isIgnored ?? false,
          needsReview: item.needsReview ?? needsReview,
          videoSources: item.videoSources ?? [],
        };
      });

      setPreviewItems(processed);
      setStep(2);
    },
    [episodeOffset, sourceType, sourceUrl]
  );

  const updateMapping = useCallback((index: number, localEpisodeId: string | null) => {
    setPreviewItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const needsReview = localEpisodeId === null;
        return {
          ...item,
          matchedLocalEpisodeId: localEpisodeId,
          needsReview,
        };
      })
    );
  }, []);

  const toggleIgnore = useCallback((index: number) => {
    setPreviewItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          isIgnored: !item.isIgnored,
        };
      })
    );
  }, []);

  const reset = useCallback(() => {
    setStep(1);
    setSourceUrl('');
    setEpisodeOffset(0);
    setPreviewItems([]);
  }, []);

  return {
    step,
    setStep,
    sourceUrl,
    setSourceUrl,
    sourceType,
    setSourceType,
    episodeOffset,
    setEpisodeOffset,
    previewItems,
    fetchPreview,
    updateMapping,
    toggleIgnore,
    reset,
  };
}
