import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { deleteEpisode } from '../../../api';

export interface UseEpisodeBatchOperationsOptions {
  onInvalidateDetail: () => Promise<unknown> | void;
  onCloseBatchDeleteDialog?: () => void;
}

export interface UseEpisodeBatchOperationsReturn {
  selectedEpisodeIds: string[];
  setSelectedEpisodeIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleEpisodeSelection: (episodeId: string) => void;
  clearSelection: () => void;
  isBatchOperating: boolean;
  handleBatchDelete: () => Promise<void>;
}

export function useEpisodeBatchOperations({
  onInvalidateDetail,
  onCloseBatchDeleteDialog,
}: UseEpisodeBatchOperationsOptions): UseEpisodeBatchOperationsReturn {
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<string[]>([]);
  const [isBatchOperating, setIsBatchOperating] = useState(false);

  const toggleEpisodeSelection = useCallback((episodeId: string) => {
    setSelectedEpisodeIds((prev) =>
      prev.includes(episodeId)
        ? prev.filter((id) => id !== episodeId)
        : [...prev, episodeId]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedEpisodeIds([]);
  }, []);

  const handleBatchDelete = useCallback(async () => {
    if (selectedEpisodeIds.length === 0) return;
    setIsBatchOperating(true);

    let successCount = 0;
    const errors: string[] = [];

    for (const epId of selectedEpisodeIds) {
      try {
        await deleteEpisode(epId);
        successCount++;
      } catch (err) {
        errors.push((err as Error).message);
      }
    }

    await onInvalidateDetail();
    setSelectedEpisodeIds([]);
    onCloseBatchDeleteDialog?.();
    setIsBatchOperating(false);

    if (successCount > 0) {
      toast.success(
        `Successfully deleted ${successCount} ${
          successCount === 1 ? 'episode' : 'episodes'
        }`
      );
    }
    if (errors.length > 0) {
      toast.error(
        `Failed to delete ${errors.length} ${
          errors.length === 1 ? 'episode' : 'episodes'
        }`
      );
    }
  }, [selectedEpisodeIds, onInvalidateDetail, onCloseBatchDeleteDialog]);

  return {
    selectedEpisodeIds,
    setSelectedEpisodeIds,
    toggleEpisodeSelection,
    clearSelection,
    isBatchOperating,
    handleBatchDelete,
  };
}
