import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEpisodeBatchOperations } from '@/modules/videos/internal/catalog';
import * as api from '@/modules/videos/internal/api';
import { toast } from 'sonner';

vi.mock('@/modules/videos/internal/api', () => ({
  deleteEpisode: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useEpisodeBatchOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks episode selection and toggles IDs correctly', () => {
    const onInvalidateDetail = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useEpisodeBatchOperations({ onInvalidateDetail })
    );

    expect(result.current.selectedEpisodeIds).toEqual([]);

    act(() => {
      result.current.toggleEpisodeSelection('ep-1');
    });
    expect(result.current.selectedEpisodeIds).toEqual(['ep-1']);

    act(() => {
      result.current.toggleEpisodeSelection('ep-2');
    });
    expect(result.current.selectedEpisodeIds).toEqual(['ep-1', 'ep-2']);

    act(() => {
      result.current.toggleEpisodeSelection('ep-1');
    });
    expect(result.current.selectedEpisodeIds).toEqual(['ep-2']);

    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.selectedEpisodeIds).toEqual([]);
  });

  it('does nothing when handleBatchDelete is called with empty selection', async () => {
    const onInvalidateDetail = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useEpisodeBatchOperations({ onInvalidateDetail })
    );

    await act(async () => {
      await result.current.handleBatchDelete();
    });

    expect(api.deleteEpisode).not.toHaveBeenCalled();
    expect(onInvalidateDetail).not.toHaveBeenCalled();
  });

  it('executes sequential batch deletion, invalidates detail, closes dialog, and notifies toast on success', async () => {
    const onInvalidateDetail = vi.fn().mockResolvedValue(undefined);
    const onCloseBatchDeleteDialog = vi.fn();
    vi.mocked(api.deleteEpisode).mockResolvedValue({ id: 'deleted' } as never);

    const { result } = renderHook(() =>
      useEpisodeBatchOperations({
        onInvalidateDetail,
        onCloseBatchDeleteDialog,
      })
    );

    act(() => {
      result.current.setSelectedEpisodeIds(['ep-1', 'ep-2']);
    });

    await act(async () => {
      await result.current.handleBatchDelete();
    });

    expect(api.deleteEpisode).toHaveBeenCalledTimes(2);
    expect(api.deleteEpisode).toHaveBeenNthCalledWith(1, 'ep-1');
    expect(api.deleteEpisode).toHaveBeenNthCalledWith(2, 'ep-2');
    expect(onInvalidateDetail).toHaveBeenCalledTimes(1);
    expect(onCloseBatchDeleteDialog).toHaveBeenCalledTimes(1);
    expect(result.current.selectedEpisodeIds).toEqual([]);
    expect(result.current.isBatchOperating).toBe(false);
    expect(toast.success).toHaveBeenCalledWith('Successfully deleted 2 episodes');
  });

  it('handles partial failures and notifies both success and error toasts', async () => {
    const onInvalidateDetail = vi.fn().mockResolvedValue(undefined);
    vi.mocked(api.deleteEpisode)
      .mockResolvedValueOnce({ id: 'deleted' } as never)
      .mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useEpisodeBatchOperations({ onInvalidateDetail })
    );

    act(() => {
      result.current.setSelectedEpisodeIds(['ep-1', 'ep-2']);
    });

    await act(async () => {
      await result.current.handleBatchDelete();
    });

    expect(onInvalidateDetail).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Successfully deleted 1 episode');
    expect(toast.error).toHaveBeenCalledWith('Failed to delete 1 episode');
  });
});
