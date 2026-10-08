import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  previewBulkSources as apiPreviewBulkSources,
  scrapeEpisodeSources,
} from '../api';
import { detectProviderFromUrl } from '../seasons/seasonUtils';

export interface SeasonGroupOption {
  id: string;
  title?: string | null;
  tmdbSeason?: number | null;
  episodes?: Array<{ id: string; title: string; order?: number; hasSources?: boolean; videoSources?: unknown[] }>;
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
  hasSources?: boolean;
  videoSources?: unknown[];
}

export function checkEpisodeHasSources(ep?: { hasSources?: boolean; videoSources?: unknown[] } | null): boolean {
  if (!ep) return false;
  return ep.hasSources ?? (Array.isArray(ep.videoSources) && ep.videoSources.length > 0);
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

export function getSeasonOptions(  seasons?: SeasonGroupOption[],
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

/**
 * Episodes of the target season in ascending order — the single source of
 * truth for combobox scoping, sequential fallback, and 1-click auto-align.
 */
export function getTargetSeasonEpisodes(
  seasons?: SeasonGroupOption[],
  localEpisodes?: LocalEpisodeItem[],
  seasonId?: string
): LocalEpisodeItem[] {
  if (seasonId && seasons && seasons.length > 0) {
    const season = seasons.find((s) => s.id === seasonId);
    if (season?.episodes) {
      return [...season.episodes]
        .map((ep) => ({ ...ep, seasonId } as LocalEpisodeItem))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
  }
  if (seasonId && localEpisodes && localEpisodes.length > 0) {
    const filtered = localEpisodes.filter((ep) => ep.seasonId === seasonId);
    if (filtered.length > 0) {
      return [...filtered].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
  }
  return [];
}

/**
 * Sequential fallback: unmatched scraped items carrying an integer episode
 * number default to the next unclaimed target-season episode in order.
 * Non-integer (decimals/specials) and excess items stay unmapped.
 */
export function applyPreviewSequentialFallback(
  items: ScrapedEpisodePreviewItem[],
  targets: Array<{ id: string; order?: number }>
): ScrapedEpisodePreviewItem[] {
  const sorted = [...targets].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const claimed = new Set<string>();
  for (const item of items) {
    if (item.matchedLocalEpisodeId) claimed.add(item.matchedLocalEpisodeId);
  }
  let cursor = 0;
  return items.map((item) => {
    const num =
      typeof item.calculatedOrder === 'number' && Number.isInteger(item.calculatedOrder)
        ? item.calculatedOrder
        : null;
    if (item.matchedLocalEpisodeId || num === null) return item;
    while (cursor < sorted.length && claimed.has(sorted[cursor].id)) cursor++;
    const target = sorted[cursor];
    if (!target) return item;
    claimed.add(target.id);
    cursor++;
    return {
      ...item,
      calculatedOrder: target.order ?? num,
      matchedLocalEpisodeId: target.id,
      needsReview: false,
    };
  });
}

export function useBulkScrapeSources(options?: UseBulkScrapeSourcesOptions) {
  const queryClient = useQueryClient();
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sourceUrl, setSourceUrlState] = useState('');
  const [sourceType, setSourceType] = useState(options?.initialSourceType ?? 'otakudesu');

  /**
   * Setting the URL auto-selects otakudesu/dramula when the URL identifies
   * the provider. Other URLs leave the current selection untouched, and the
   * Source Type select always remains the final manual authority.
   */
  const setSourceUrl = useCallback((url: string) => {
    setSourceUrlState(url);
    const detected = detectProviderFromUrl(url);
    if (detected) setSourceType(detected);
  }, []);

  const seasonOptions = useMemo(
    () => getSeasonOptions(options?.seasons, options?.localEpisodes),
    [options?.seasons, options?.localEpisodes]
  );

  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(
    () => seasonOptions[0]?.id ?? ''
  );
  const selectedSeasonIdRef = useRef(selectedSeasonId);
  useEffect(() => {
    selectedSeasonIdRef.current = selectedSeasonId;
  }, [selectedSeasonId]);

  const selectSeason = useCallback((seasonId: string) => {
    setSelectedSeasonId(seasonId);
  }, []);

  useEffect(() => {
    if (seasonOptions.length > 0) {
      if (!selectedSeasonId || !seasonOptions.some((s) => s.id === selectedSeasonId)) {
        setSelectedSeasonId(seasonOptions[0].id);
      }
    }
  }, [seasonOptions, selectedSeasonId]);
  const [previewItems, setPreviewItems] = useState<ScrapedEpisodePreviewItem[]>([]);
  const [fetchedLocalEpisodes, setFetchedLocalEpisodes] = useState<LocalEpisodeItem[]>([]);
  const fetchedLocalEpisodesRef = useRef<LocalEpisodeItem[]>([]);
  useEffect(() => {
    fetchedLocalEpisodesRef.current = fetchedLocalEpisodes;
  }, [fetchedLocalEpisodes]);

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
        const activeSeasonId = selectedSeasonIdRef.current;
        const scopedLocalEpisodes =
          activeSeasonId && localEpisodes.length > 0 && localEpisodes.some((ep) => ep.seasonId)
            ? localEpisodes.filter((ep) => ep.seasonId === activeSeasonId)
            : localEpisodes;
        const initial: ScrapedEpisodePreviewItem[] = rawMockItems.map((item, idx) => {
          const rawNum = item.rawEpisodeNumber ?? idx + 1;
          const isNumInteger = typeof rawNum === 'number' ? Number.isInteger(rawNum) : /^\d+$/.test(String(rawNum).trim());
          const parsedInt = typeof rawNum === 'number' ? Math.floor(rawNum) : parseInt(String(rawNum), 10);

          let calculatedOrder: number | null = null;
          let matchedLocalEpisodeId: string | null = null;
          let needsReview = false;

          if (isNumInteger && !isNaN(parsedInt)) {
            calculatedOrder = parsedInt;
            const match = scopedLocalEpisodes.find((ep) => ep.order === calculatedOrder);
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

        const seasonTargets = getTargetSeasonEpisodes(
          options?.seasons,
          localEpisodes.length > 0 ? localEpisodes : undefined,
          activeSeasonId
        );
        const fallbackTargets =
          seasonTargets.length > 0 ? seasonTargets : scopedLocalEpisodes;
        const processed = applyPreviewSequentialFallback(initial, fallbackTargets);

        return {
          scrapedItems: processed,
          localEpisodes,
        };
      }

      const res = await apiPreviewBulkSources({
        seriesId: targetSeriesId,
        sourceUrl,
        source: (sourceType as 'otakudesu' | 'dramula') || 'otakudesu',
        episodeOffset: 0,
        seasonId: selectedSeasonId || undefined,
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
              label: sourceType === 'dramula' ? 'Dramula' : 'Otakudesu',
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
          hasSources: le.hasSources,
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
          } catch (err: unknown) {
            const errorMessage =
              err instanceof Error ? err.message : 'Failed to scrape episode sources';
            setProcessingLogs((prev) =>
              prev.map((log, idx) =>
                idx === i
                  ? {
                      ...log,
                      status: 'error',
                      message: `${item.scrapedTitle}: ${errorMessage}`,
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
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to save bulk sources.';
        toast.error('Save Bulk Sources Error', {
          description: errorMessage,
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

  const resetPreviewRef = useRef(previewMutation.reset);
  useEffect(() => {
    resetPreviewRef.current = previewMutation.reset;
  });

  const reset = useCallback(() => {
    setStep(1);
    setSourceUrl('');
    const currentSeasons = optionsRef.current?.seasons;
    const currentLocalEps = optionsRef.current?.localEpisodes;
    const currentSeasonOptions = getSeasonOptions(currentSeasons, currentLocalEps);
    const defaultSeasonId = currentSeasonOptions[0]?.id ?? '';
    setSelectedSeasonId(defaultSeasonId);
    setPreviewItems([]);
    setFetchedLocalEpisodes([]);
    setProcessingLogs([]);
    setIsProcessing(false);
    setCompletedCount(0);
    resetPreviewRef.current();
  }, [setSourceUrl]);

  const totalCount = previewItems.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const localEpisodesMap = useMemo(() => {
    const map = new Map<string, { id: string; title: string; order?: number; hasSources?: boolean; videoSources?: unknown[] }>();

    if (options?.localEpisodes) {
      for (const ep of options.localEpisodes) {
        map.set(ep.id, ep);
      }
    }

    if (options?.seasons) {
      for (const s of options.seasons) {
        if (s.episodes) {
          for (const ep of s.episodes) {
            map.set(ep.id, ep);
          }
        }
      }
    }

    for (const ep of fetchedLocalEpisodes) {
      map.set(ep.id, ep);
    }

    return map;
  }, [options?.localEpisodes, options?.seasons, fetchedLocalEpisodes]);

  const isEpisodeHasSources = useCallback(
    (episodeId: string | null): boolean => {
      if (!episodeId) return false;
      return checkEpisodeHasSources(localEpisodesMap.get(episodeId));
    },
    [localEpisodesMap]
  );

  const hasOverwriteConflicts = useMemo(() => {
    return previewItems.some((item) => {
      if (item.isIgnored || !item.matchedLocalEpisodeId) return false;
      return isEpisodeHasSources(item.matchedLocalEpisodeId);
    });
  }, [previewItems, isEpisodeHasSources]);

  const targetSeasonEpisodes = useMemo(
    () =>
      getTargetSeasonEpisodes(
        options?.seasons,
        [...(options?.localEpisodes ?? []), ...fetchedLocalEpisodes],
        selectedSeasonId
      ),
    [options?.seasons, options?.localEpisodes, fetchedLocalEpisodes, selectedSeasonId]
  );

  /**
   * 1-click sequential auto-align: map scraped items 1:1 down the target
   * season's episodes in order (Scraped 1 → Target Ep 1, ...). Excess items
   * beyond the season length stay unmapped.
   */
  const autoAlignSequentially = useCallback(() => {
    const targets = getTargetSeasonEpisodes(
      optionsRef.current?.seasons,
      [
        ...(optionsRef.current?.localEpisodes ?? []),
        ...fetchedLocalEpisodesRef.current,
      ],
      selectedSeasonIdRef.current
    );
    setPreviewItems((prev) =>
      prev.map((item, idx) => {
        const target = targets[idx];
        if (!target) {
          return { ...item, matchedLocalEpisodeId: null, needsReview: true };
        }
        return {
          ...item,
          calculatedOrder: target.order ?? item.calculatedOrder,
          matchedLocalEpisodeId: target.id,
          needsReview: false,
        };
      })
    );
  }, []);

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
    targetSeasonEpisodes,
    autoAlignSequentially,
    reset,
    isEpisodeHasSources,
    hasOverwriteConflicts,
  };
}
