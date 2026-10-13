import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  addVideoSource,
  deleteVideoSource,
  updateVideoSource,
} from '../../api';
import type {
  UseSourceMutationsOptions,
  UseSourceMutationsReturn,
} from '../types';

export function useSourceMutations({
  episodeId,
}: UseSourceMutationsOptions): UseSourceMutationsReturn {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['series'] });
    queryClient.invalidateQueries({ queryKey: ['episodes'] });
  };

  const addMutation = useMutation({
    mutationFn: (sourceInput: Parameters<typeof addVideoSource>[1]) =>
      addVideoSource(episodeId, sourceInput),
    onSuccess: () => {
      toast.success('Source added successfully');
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(`Failed to add source: ${err.message}`);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({
      sourceId,
      updates,
    }: {
      sourceId: string;
      updates: Parameters<typeof updateVideoSource>[2];
    }) => updateVideoSource(episodeId, sourceId, updates),
    onSuccess: () => {
      toast.success('Source updated');
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(`Failed to update source: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sourceId: string) => deleteVideoSource(episodeId, sourceId),
    onSuccess: () => {
      toast.success('Source removed');
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete source: ${err.message}`);
    },
  });

  return { addMutation, editMutation, deleteMutation };
}
