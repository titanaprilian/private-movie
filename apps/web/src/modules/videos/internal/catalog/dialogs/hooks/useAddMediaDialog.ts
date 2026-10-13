import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAddMediaStore } from './useAddMediaStore';
import { importTmdb, type ImportTmdbParams } from '../../../api';

import type { UseAddMediaDialogReturn } from '../../types';
export type { UseAddMediaDialogReturn } from '../../types';

export function useAddMediaDialog(): UseAddMediaDialogReturn {
  const queryClient = useQueryClient();

  const isOpen = useAddMediaStore((state) => state.isOpen);
  const step = useAddMediaStore((state) => state.step);
  const tmdbType = useAddMediaStore((state) => state.tmdbType);
  const tmdbId = useAddMediaStore((state) => state.tmdbId);
  const includeSpecials = useAddMediaStore((state) => state.includeSpecials);
  const tmdbPreviewData = useAddMediaStore((state) => state.tmdbPreviewData);
  const isLoading = useAddMediaStore((state) => state.isLoading);
  const error = useAddMediaStore((state) => state.error);

  const resetStore = useAddMediaStore((state) => state.reset);
  const setTmdbType = useAddMediaStore((state) => state.setTmdbType);
  const setTmdbId = useAddMediaStore((state) => state.setTmdbId);
  const setIncludeSpecials = useAddMediaStore((state) => state.setIncludeSpecials);
  const submitPreview = useAddMediaStore((state) => state.submitPreview);
  const backToStep1 = useAddMediaStore((state) => state.backToStep1);

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
