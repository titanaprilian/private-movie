import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useBulkScrapeSources } from './useBulkScrapeSources';
import type {
  LocalEpisodeItem,
  SeasonGroupOption,
} from '../../types';

export interface UseBulkScrapeModalOptions {
  seriesId: string;
  seasons?: SeasonGroupOption[];
  localEpisodes?: LocalEpisodeItem[];
  onSuccess?: () => void;
}

export function useBulkScrapeModal({
  seriesId,
  seasons,
  localEpisodes = [],
  onSuccess,
}: UseBulkScrapeModalOptions) {
  const sources = useBulkScrapeSources({ seriesId, seasons, localEpisodes, onSuccess });
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

  const { reset, autoAlignSequentially, previewItems, targetSeasonEpisodes } = sources;

  const resetOnClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        reset();
        setShowOverwriteConfirm(false);
      }
    },
    [reset],
  );

  const handlePreviewSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!sources.sourceUrl.trim()) {
        toast.error('Source URL required', {
          description: 'Please enter a valid scraper season URL.',
        });
        return;
      }
      sources.fetchPreview(localEpisodes);
    },
    [sources, localEpisodes],
  );

  const handleSaveConfirm = useCallback(async () => {
    setShowOverwriteConfirm(false);
    try {
      await sources.saveBulkSources(seriesId);
    } catch {
      // Error handled by toast in hook
    }
  }, [sources, seriesId]);

  const handleSaveClick = useCallback(() => {
    if (sources.hasOverwriteConflicts) {
      setShowOverwriteConfirm(true);
    } else {
      void handleSaveConfirm();
    }
  }, [sources.hasOverwriteConflicts, handleSaveConfirm]);

  const handleAutoAlign = useCallback(() => {
    autoAlignSequentially();
    const mappedCount = Math.min(previewItems.length, targetSeasonEpisodes.length);
    toast.success('Auto-aligned sequentially', {
      description: `Mapped ${mappedCount} scraped episode${mappedCount === 1 ? '' : 's'} 1:1 down the target season.`,
    });
  }, [autoAlignSequentially, previewItems.length, targetSeasonEpisodes.length]);

  return {
    ...sources,
    showOverwriteConfirm,
    setShowOverwriteConfirm,
    resetOnClose,
    handlePreviewSubmit,
    handleSaveClick,
    handleSaveConfirm,
    handleAutoAlign,
  };
}

export type UseBulkScrapeModalReturn = ReturnType<typeof useBulkScrapeModal>;
