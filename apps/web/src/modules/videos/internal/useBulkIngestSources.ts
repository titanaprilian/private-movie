import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { parseIngestUrl } from './parseIngestUrl';
import { remoteIngestEpisodeVideoSource } from './api';
import {
  getSeasonOptions,
  type LocalEpisodeItem,
  type SeasonGroupOption,
} from './useBulkScrapeSources';

export interface BulkIngestItem {
  id: string;
  url: string;
  filename: string;
  detectedEpisodeNumber: number | null;
  matchedLocalEpisodeId: string | null;
  label: string;
  quality: string | null;
  isIgnored: boolean;
  needsReview: boolean;
  status: 'pending' | 'ingesting' | 'completed' | 'failed' | 'skipped';
  progress?: {
    percent: number;
    loaded: number;
    total: number;
  };
  errorMessage?: string;
}

export interface UseBulkIngestSourcesOptions {
  seriesId?: string;
  seasons?: SeasonGroupOption[];
  localEpisodes?: LocalEpisodeItem[];
  onSuccess?: () => void;
}

export function useBulkIngestSources(options?: UseBulkIngestSourcesOptions) {
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rawUrlsText, setRawUrlsText] = useState('');
  const [defaultLabel, setDefaultLabel] = useState('S3 Video');
  const [defaultQuality, setDefaultQuality] = useState('');
  const [sharedReferer, setSharedReferer] = useState('');

  const seasonOptions = useMemo(
    () => getSeasonOptions(options?.seasons, options?.localEpisodes),
    [options?.seasons, options?.localEpisodes]
  );

  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(
    () => seasonOptions[0]?.id ?? ''
  );

  useEffect(() => {
    if (seasonOptions.length > 0) {
      if (!selectedSeasonId || !seasonOptions.some((s) => s.id === selectedSeasonId)) {
        setSelectedSeasonId(seasonOptions[0].id);
      }
    }
  }, [seasonOptions, selectedSeasonId]);

  const [items, setItems] = useState<BulkIngestItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Available local episodes for mapping based on selected season
  const availableLocalEpisodes = useMemo(() => {
    let result: LocalEpisodeItem[] = [];

    if (options?.seasons && options.seasons.length > 0) {
      const targetSeason = options.seasons.find((s) => s.id === selectedSeasonId) ?? options.seasons[0];
      if (targetSeason?.episodes) {
        result = targetSeason.episodes.map((ep) => ({
          id: ep.id,
          title: ep.title,
          order: ep.order,
          seasonId: targetSeason.id,
          seasonTitle: targetSeason.title ?? undefined,
          hasSources: ep.hasSources,
        }));
      }
    }

    if (result.length === 0 && options?.localEpisodes && options.localEpisodes.length > 0) {
      if (selectedSeasonId) {
        result = options.localEpisodes.filter((ep) => ep.seasonId === selectedSeasonId);
      }
      if (result.length === 0) {
        result = options.localEpisodes;
      }
    }

    return result;
  }, [selectedSeasonId, options?.seasons, options?.localEpisodes]);

  // Step 1 -> Step 2: Parse raw text into structured items
  const parseUrls = useCallback((textInput?: string) => {
    const textToParse = textInput !== undefined ? textInput : rawUrlsText;
    if (textInput !== undefined) {
      setRawUrlsText(textInput);
    }
    const lines = textToParse
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      toast.error('No URLs provided', {
        description: 'Please paste at least one direct video URL.',
      });
      return false;
    }

    const parsedItems: BulkIngestItem[] = lines.map((url, idx) => {
      const parsed = parseIngestUrl(url);
      const quality = defaultQuality || parsed.quality || null;
      const label = defaultLabel && defaultLabel !== 'S3 Video' ? defaultLabel : parsed.label;

      let matchedLocalEpisodeId: string | null = null;
      let needsReview = true;

      if (parsed.detectedEpisodeNumber !== null) {
        const match = availableLocalEpisodes.find((ep) => ep.order === parsed.detectedEpisodeNumber);
        if (match) {
          matchedLocalEpisodeId = match.id;
          needsReview = false;
        }
      }

      return {
        id: `ingest-item-${idx}-${Date.now()}`,
        url,
        filename: parsed.filename,
        detectedEpisodeNumber: parsed.detectedEpisodeNumber,
        matchedLocalEpisodeId,
        label,
        quality,
        isIgnored: false,
        needsReview,
        status: 'pending',
      };
    });

    setItems(parsedItems);
    setStep(2);
    return true;
  }, [rawUrlsText, defaultQuality, defaultLabel, availableLocalEpisodes]);

  // Update target local episode mapping
  const updateMapping = useCallback((index: number, localEpisodeId: string | null) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          matchedLocalEpisodeId: localEpisodeId,
          needsReview: localEpisodeId === null,
        };
      })
    );
  }, []);

  // Editable label
  const updateLabel = useCallback((index: number, label: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, label } : item))
    );
  }, []);

  // Editable quality
  const updateQuality = useCallback((index: number, quality: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quality: quality || null } : item))
    );
  }, []);

  // Toggle Include / Ignore
  const toggleIgnore = useCallback((index: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, isIgnored: !item.isIgnored } : item))
    );
  }, []);

  // Summary counts
  const totalCount = items.length;
  const matchedCount = useMemo(
    () => items.filter((i) => !i.isIgnored && i.matchedLocalEpisodeId !== null).length,
    [items]
  );
  const needsReviewCount = useMemo(
    () => items.filter((i) => !i.isIgnored && (i.needsReview || i.matchedLocalEpisodeId === null)).length,
    [items]
  );

  // Step 2 -> Step 3: Sequential ingest execution loop
  const startIngestQueue = useCallback(async () => {
    setStep(3);
    setIsProcessing(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Prepare initial status
    let initialSkipped = 0;
    const initialItems = items.map((item) => {
      if (item.isIgnored || !item.matchedLocalEpisodeId) {
        initialSkipped++;
        return {
          ...item,
          status: 'skipped' as const,
          errorMessage: item.isIgnored ? 'Ignored' : 'Unmapped',
        };
      }
      return {
        ...item,
        status: 'pending' as const,
        progress: undefined,
        errorMessage: undefined,
      };
    });

    setItems(initialItems);
    setCompletedCount(initialSkipped);

    let currentCompleted = initialSkipped;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < initialItems.length; i++) {
      if (controller.signal.aborted) break;

      const currentItem = initialItems[i];
      if (currentItem.isIgnored || !currentItem.matchedLocalEpisodeId) {
        continue;
      }

      // Mark current item as ingesting
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === i
            ? { ...item, status: 'ingesting', progress: { percent: 0, loaded: 0, total: 0 } }
            : item
        )
      );

      try {
        await remoteIngestEpisodeVideoSource(currentItem.matchedLocalEpisodeId, {
          url: currentItem.url,
          label: currentItem.label,
          quality: currentItem.quality,
          referer: sharedReferer || undefined,
          signal: controller.signal,
          onProgress: (p) => {
            setItems((prev) =>
              prev.map((item, idx) =>
                idx === i ? { ...item, progress: p } : item
              )
            );
          },
        });

        if (controller.signal.aborted) break;

        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'completed' } : item
          )
        );
        successCount++;
      } catch (err: any) {
        if (controller.signal.aborted || err.name === 'AbortError') {
          setItems((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, status: 'failed', errorMessage: 'Cancelled' } : item
            )
          );
          break;
        }

        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: 'failed',
                  errorMessage: err.message || 'Ingest failed',
                }
              : item
          )
        );
        errorCount++;
      }

      currentCompleted++;
      setCompletedCount(currentCompleted);
    }

    setIsProcessing(false);

    // Invalidate series queries on completion
    if (options?.seriesId) {
      queryClient.invalidateQueries({ queryKey: ['series', options.seriesId] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
    }

    if (!controller.signal.aborted) {
      if (successCount > 0) {
        toast.success('Bulk ingest complete', {
          description: `Successfully ingested ${successCount} video(s)${
            errorCount > 0 ? ` (${errorCount} failed)` : ''
          }.`,
        });
      } else if (errorCount > 0) {
        toast.error('Bulk ingest failed', {
          description: `All ${errorCount} URL ingestions failed.`,
        });
      }
      options?.onSuccess?.();
    }
  }, [items, sharedReferer, options, queryClient]);

  // Cancel ongoing queue execution
  const cancelQueue = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);

    setItems((prev) =>
      prev.map((item) => {
        if (item.status === 'pending' || item.status === 'ingesting') {
          return {
            ...item,
            status: 'failed',
            errorMessage: 'Cancelled',
          };
        }
        return item;
      })
    );

    toast.info('Bulk ingest queue cancelled');
  }, []);

  // Reset entire hook state
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStep(1);
    setRawUrlsText('');
    setDefaultLabel('S3 Video');
    setDefaultQuality('');
    setSharedReferer('');
    setItems([]);
    setIsProcessing(false);
    setCompletedCount(0);
    const defaultSeasonId = seasonOptions[0]?.id ?? '';
    setSelectedSeasonId(defaultSeasonId);
  }, [seasonOptions]);

  const progressPercentage =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const activeItem = useMemo(
    () => items.find((i) => i.status === 'ingesting') ?? null,
    [items]
  );

  return {
    step,
    setStep,
    rawUrlsText,
    setRawUrlsText,
    defaultLabel,
    setDefaultLabel,
    defaultQuality,
    setDefaultQuality,
    sharedReferer,
    setSharedReferer,
    selectedSeasonId,
    setSelectedSeasonId,
    seasonOptions,
    availableLocalEpisodes,
    items,
    setItems,
    parseUrls,
    updateMapping,
    updateLabel,
    updateQuality,
    toggleIgnore,
    totalCount,
    matchedCount,
    needsReviewCount,
    startIngestQueue,
    cancelQueue,
    isProcessing,
    completedCount,
    progressPercentage,
    activeItem,
    reset,
  };
}
