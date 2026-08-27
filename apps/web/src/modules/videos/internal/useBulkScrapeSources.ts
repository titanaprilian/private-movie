import { useState, useCallback, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  previewBulkSources as apiPreviewBulkSources,
  scrapeEpisodeSources,
} from './api';

export interface SeasonGroupOption {
  id: string;
  title?: string | null;
  tmdbSeason?: number | null;
  episodes?: Array<{ id: string; title: string; order?: number }>;
}

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

export interface ProcessingLogItem {
  id: string;
  scrapedTitle: string;
  rawEpisodeNumber: number | string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'skipped';
  message: string;
}

export interface UseBulkScrapeSourcesOptions {
  seriesId?: string;
  initialSourceType?: string;
  onSuccess?: () => void;
  stepDelayMs?: number;
  seasons?: SeasonGroupOption[];
  localEpisodes?: LocalEpisodeItem[];
}

export function getSeasonOptions(
  seasons?: SeasonGroupOption[],
  localEpisodes?: LocalEpisodeItem[]
): Array<{ id: string; label: string }> {
  if (seasons && seasons.length > 0) {
    return seasons.map((s) => ({
      id: s.id,
      label: s.title || (typeof s.tmdbSeason === 'number' ? `Season ${s.tmdbSeason}` : 'Season'),
    }));
  }

  if (localEpisodes && localEpisodes.length > 0) {
    const seasonMap = new Map<string, string>();
    for (const ep of localEpisodes) {
      if (ep.seasonId && !seasonMap.has(ep.seasonId)) {
        const label =
          ep.seasonTitle ||
          (typeof ep.seasonNumber === 'number' ? `Season ${ep.seasonNumber}` : 'Season');
        seasonMap.set(ep.seasonId, label);
      }
    }
    return Array.from(seasonMap.entries()).map(([id, label]) => ({ id, label }));
  }

  return [];
}

export function calculateSeasonOffset(
  seasonId: string,
  seasons?: SeasonGroupOption[],
  localEpisodes?: LocalEpisodeItem[]
): number {
  if (!seasonId) return 0;

  if (seasons && seasons.length > 0) {
    const seasonObj = seasons.find((s) => s.id === seasonId);
    if (seasonObj?.episodes && seasonObj.episodes.length > 0) {
      const orders = seasonObj.episodes
        .map((ep) => ep.order)
        .filter((ord): ord is number => typeof ord === 'number' && !isNaN(ord));
      if (orders.length > 0) {
        const minOrder = Math.min(...orders);
        return minOrder - 1;
      }
    }
  }

  if (localEpisodes && localEpisodes.length > 0) {
    const epMatches = localEpisodes.filter((ep) => ep.seasonId === seasonId);
    if (epMatches.length > 0) {
      const orders = epMatches
        .map((ep) => ep.order)
        .filter((ord): ord is number => typeof ord === 'number' && !isNaN(ord));
      if (orders.length > 0) {
        const minOrder = Math.min(...orders);
        return minOrder - 1;
      }
    }
  }

  return 0;
}

export function useBulkScrapeSources(options?: UseBulkScrapeSourcesOptions) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceType, setSourceType] = useState(options?.initialSourceType ?? 'otakudesu');

  const seasonOptions = useMemo(
    () => getSeasonOptions(options?.seasons, options?.localEpisodes),
    [options?.seasons, options?.localEpisodes]
  );

  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(
    () => seasonOptions[0]?.id ?? ''
  );

  const [episodeOffset, setEpisodeOffset] = useState<number>(() => {
    const defaultId = seasonOptions[0]?.id;
    return defaultId
      ? calculateSeasonOffset(defaultId, options?.seasons, options?.localEpisodes)
      : 0;
  });

  const selectSeason = useCallback(
    (
      seasonId: string,
      seasonsParam?: SeasonGroupOption[],
      localEpisodesParam?: LocalEpisodeItem[]
    ) => {
      setSelectedSeasonId(seasonId);
      const activeSeasons = seasonsParam ?? options?.seasons;
      const activeLocalEps = localEpisodesParam ?? options?.localEpisodes;
      const offset = calculateSeasonOffset(seasonId, activeSeasons, activeLocalEps);
      setEpisodeOffset(offset);
    },
    [options?.seasons, options?.localEpisodes]
  );

  useEffect(() => {
    if (seasonOptions.length > 0) {
      if (!selectedSeasonId || !seasonOptions.some((s) => s.id === selectedSeasonId)) {
        const defaultId = seasonOptions[0].id;
        setSelectedSeasonId(defaultId);
        const offset = calculateSeasonOffset(
          defaultId,
          options?.seasons,
          options?.localEpisodes
        );
        setEpisodeOffset(offset);
      }
    }
  }, [seasonOptions, selectedSeasonId, options?.seasons, options?.localEpisodes]);
  const [previewItems, setPreviewItems] = useState<ScrapedEpisodePreviewItem[]>([]);
  const [fetchedLocalEpisodes, setFetchedLocalEpisodes] = useState<LocalEpisodeItem[]>([]);

  // Step 3 Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLogs, setProcessingLogs] = useState<ProcessingLogItem[]>([]);
  const [completedCount, setCompletedCount] = useState(0);

  const previewMutation = useMutation({
    mutationFn: async (params?: {
      seriesId?: string;
      localEpisodes?: LocalEpisodeItem[];
      customItems?: Partial<ScrapedEpisodePreviewItem>[];
    }) => {
      const targetSeriesId = params?.seriesId ?? options?.seriesId;

      if (!targetSeriesId || params?.customItems) {
        const rawMockItems: Partial<ScrapedEpisodePreviewItem>[] = params?.customItems ?? [
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

        const localEpisodes = params?.localEpisodes ?? [];
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

        return {
          scrapedItems: processed,
          localEpisodes,
        };
      }

      const res = await apiPreviewBulkSources({
        seriesId: targetSeriesId,
        sourceUrl,
        source: (sourceType as 'otakudesu') || 'otakudesu',
        episodeOffset,
      });

      const processed: ScrapedEpisodePreviewItem[] = res.scrapedEpisodes.map((ep, idx) => {
        const rawNum = ep.episodeNumber ?? idx + 1;
        const needsReview = ep.matchStatus === 'unmatched' || ep.matchedLocalEpisodeId === null;
        return {
          id: ep.scrapedUrl || `scraped-${idx}`,
          scrapedTitle: ep.scrapedTitle,
          rawEpisodeNumber: rawNum,
          calculatedOrder: ep.calculatedOrder,
          matchedLocalEpisodeId: ep.matchedLocalEpisodeId,
          isIgnored: false,
          needsReview,
          videoSources: [
            {
              type: sourceType === 'direct' ? 'direct' : 'embed',
              url: ep.scrapedUrl,
              label: 'Otakudesu',
            },
          ],
        };
      });

      return {
        scrapedItems: processed,
        localEpisodes: res.localEpisodes.map((le) => ({
          id: le.id,
          title: le.title,
          order: le.order,
          seasonId: le.seasonId,
          seasonNumber: le.seasonNumber ?? undefined,
          seasonTitle: le.seasonTitle,
        })),
      };
    },
    onSuccess: (data) => {
      setPreviewItems(data.scrapedItems);
      if (data.localEpisodes.length > 0) {
        setFetchedLocalEpisodes(data.localEpisodes);
      }
      setStep(2);
    },
    onError: (error: Error) => {
      toast.error('Bulk Scrape Preview Error', {
        description: error.message || 'Failed to fetch bulk scrape preview from server.',
      });
    },
  });

  const fetchPreview = useCallback(
    (
      localEpisodes: LocalEpisodeItem[] = [],
      customItems?: Partial<ScrapedEpisodePreviewItem>[]
    ) => {
      previewMutation.mutate({ localEpisodes, customItems });
    },
    [previewMutation]
  );

  const saveBulkSources = useCallback(
    async (seriesIdParam?: string) => {
      setStep(3);
      setIsProcessing(true);

      const initialLogs: ProcessingLogItem[] = previewItems.map((item) => {
        if (item.isIgnored) {
          return {
            id: item.id,
            scrapedTitle: item.scrapedTitle,
            rawEpisodeNumber: item.rawEpisodeNumber,
            status: 'skipped',
            message: `${item.scrapedTitle}: Skipped (Ignored)`,
          };
        }
        if (!item.matchedLocalEpisodeId) {
          return {
            id: item.id,
            scrapedTitle: item.scrapedTitle,
            rawEpisodeNumber: item.rawEpisodeNumber,
            status: 'skipped',
            message: `${item.scrapedTitle}: Skipped (Unmapped)`,
          };
        }
        return {
          id: item.id,
          scrapedTitle: item.scrapedTitle,
          rawEpisodeNumber: item.rawEpisodeNumber,
          status: 'pending',
          message: `${item.scrapedTitle}: Pending`,
        };
      });

      setProcessingLogs(initialLogs);

      const initialCompleted = initialLogs.filter((l) => l.status === 'skipped').length;
      setCompletedCount(initialCompleted);
      let currentCompleted = initialCompleted;

      let successCount = 0;
      let errorCount = 0;
      const skippedCount = initialCompleted;

      try {
        for (let i = 0; i < previewItems.length; i++) {
          const item = previewItems[i];
          if (item.isIgnored || !item.matchedLocalEpisodeId) continue;

          setProcessingLogs((prev) =>
            prev.map((log, idx) =>
              idx === i
                ? {
                    ...log,
                    status: 'processing',
                    message: `${item.scrapedTitle}: Scraping sources...`,
                  }
                : log
            )
          );

          const urlToScrape = item.videoSources[0]?.url || item.id;

          try {
            await scrapeEpisodeSources(item.matchedLocalEpisodeId, urlToScrape);

            setProcessingLogs((prev) =>
              prev.map((log, idx) =>
                idx === i
                  ? {
                      ...log,
                      status: 'success',
                      message: `${item.scrapedTitle}: Scraped successfully`,
                    }
                  : log
              )
            );
            successCount += 1;
          } catch (err: any) {
            setProcessingLogs((prev) =>
              prev.map((log, idx) =>
                idx === i
                  ? {
                      ...log,
                      status: 'error',
                      message: `${item.scrapedTitle}: ${err?.message || 'Failed to scrape episode sources'}`,
                    }
                  : log
              )
            );
            errorCount += 1;
          }

          currentCompleted += 1;
          setCompletedCount(currentCompleted);
        }

        const targetSeriesId = seriesIdParam ?? options?.seriesId;
        if (targetSeriesId) {
          queryClient.invalidateQueries({ queryKey: ['series', targetSeriesId] });
          queryClient.invalidateQueries({ queryKey: ['series'] });
          queryClient.invalidateQueries({ queryKey: ['episodes'] });
        }

        if (successCount > 0) {
          toast.success('Bulk sources processed', {
            description: `Successfully scraped ${successCount} episode sources${errorCount > 0 ? ` (${errorCount} failed)` : ''}.`,
          });
        } else if (errorCount > 0) {
          toast.error('Bulk scrape failed', {
            description: `All ${errorCount} episode scrapes failed. Check log details.`,
          });
        }

        options?.onSuccess?.();
        return { success: true, savedCount: successCount, skippedCount, errorCount };
      } catch (error: any) {
        toast.error('Save Bulk Sources Error', {
          description: error?.message || 'Failed to save bulk sources.',
        });
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [previewItems, options, queryClient]
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

  const { reset: resetPreview } = previewMutation;

  const reset = useCallback(() => {
    setStep(1);
    setSourceUrl('');
    const defaultSeasonId = seasonOptions[0]?.id ?? '';
    setSelectedSeasonId(defaultSeasonId);
    const initialOffset = defaultSeasonId
      ? calculateSeasonOffset(defaultSeasonId, options?.seasons, options?.localEpisodes)
      : 0;
    setEpisodeOffset(initialOffset);
    setPreviewItems([]);
    setFetchedLocalEpisodes([]);
    setProcessingLogs([]);
    setIsProcessing(false);
    setCompletedCount(0);
    resetPreview();
  }, [seasonOptions, options?.seasons, options?.localEpisodes, resetPreview]);

  const totalCount = previewItems.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    step,
    setStep,
    sourceUrl,
    setSourceUrl,
    sourceType,
    setSourceType,
    selectedSeasonId,
    setSelectedSeasonId,
    selectSeason,
    seasonOptions,
    episodeOffset,
    setEpisodeOffset,
    previewItems,
    fetchedLocalEpisodes,
    fetchPreview,
    saveBulkSources,
    isFetchingPreview: previewMutation.isPending,
    isSaving: isProcessing,
    isProcessing,
    processingLogs,
    progress,
    completedCount,
    totalCount,
    previewError: previewMutation.error,
    saveError: null,
    updateMapping,
    toggleIgnore,
    reset,
  };
}
