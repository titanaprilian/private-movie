import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useScrapeWorkerStore } from '../../store/useScrapeWorkerStore';
import { importTmdb, type ImportTmdbParams } from '../../api';

import type { UseAddMediaDialogReturn } from '../types';
export type { UseAddMediaDialogReturn } from '../types';

export function useAddMediaDialog(): UseAddMediaDialogReturn {
  const queryClient = useQueryClient();

  const isOpen = useScrapeWorkerStore((state) => state.isOpen);
  const step = useScrapeWorkerStore((state) => state.step);
  const tmdbType = useScrapeWorkerStore((state) => state.tmdbType);
  const tmdbId = useScrapeWorkerStore((state) => state.tmdbId);
  const includeSpecials = useScrapeWorkerStore((state) => state.includeSpecials);
  const tmdbPreviewData = useScrapeWorkerStore((state) => state.tmdbPreviewData);
  const isLoading = useScrapeWorkerStore((state) => state.isLoading);
  const error = useScrapeWorkerStore((state) => state.error);

  const resetStore = useScrapeWorkerStore((state) => state.reset);
  const setTmdbType = useScrapeWorkerStore((state) => state.setTmdbType);
  const setTmdbId = useScrapeWorkerStore((state) => state.setTmdbId);
  const setIncludeSpecials = useScrapeWorkerStore((state) => state.setIncludeSpecials);
  const submitPreview = useScrapeWorkerStore((state) => state.submitPreview);
  const backToStep1 = useScrapeWorkerStore((state) => state.backToStep1);

  const closeDialog = () => {
    resetStore();
  };

  const importTmdbMutation = useMutation({
    mutationFn: (params: ImportTmdbParams) => importTmdb(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      toast.success('Series imported successfully');
      closeDialog();
    },
  });

  return {
    isOpen,
    step,
    tmdbType,
    tmdbId,
    includeSpecials,
    tmdbPreviewData,
    isLoading,
    error,
    setTmdbType,
    setTmdbId,
    setIncludeSpecials,
    submitPreview,
    backToStep1,
    closeDialog,
    importTmdbMutation,
  };
}
