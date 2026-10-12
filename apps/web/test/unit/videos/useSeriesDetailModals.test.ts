import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSeriesDetailModals } from '@/modules/videos/internal/catalog/hooks/useSeriesDetailModals';

describe('useSeriesDetailModals', () => {
  it('initializes with all dialogs closed and null/undefined values', () => {
    const { result } = renderHook(() => useSeriesDetailModals());

    expect(result.current.isMoveEpisodesOpen).toBe(false);
    expect(result.current.isBatchDeleteOpen).toBe(false);
    expect(result.current.isEditSeriesOpen).toBe(false);
    expect(result.current.isSyncTmdbOpen).toBe(false);
    expect(result.current.isBulkScrapeOpen).toBe(false);
    expect(result.current.bulkScrapeEpisodeIds).toBeNull();
    expect(result.current.isBulkIngestOpen).toBe(false);
    expect(result.current.isEditSeasonOpen).toBe(false);
    expect(result.current.isAddSeasonOpen).toBe(false);
    expect(result.current.isDeleteSeasonOpen).toBe(false);
    expect(result.current.isEditDialogOpen).toBe(false);
    expect(result.current.isManageSourcesOpen).toBe(false);
    expect(result.current.manageSourcesInitialTab).toBeUndefined();
    expect(result.current.isDeleteDialogOpen).toBe(false);
  });

  it('updates dialog open/close states', () => {
    const { result } = renderHook(() => useSeriesDetailModals());

    act(() => {
      result.current.setIsMoveEpisodesOpen(true);
      result.current.setIsBatchDeleteOpen(true);
      result.current.setIsEditSeriesOpen(true);
      result.current.setIsSyncTmdbOpen(true);
      result.current.setIsBulkIngestOpen(true);
      result.current.setIsEditSeasonOpen(true);
      result.current.setIsAddSeasonOpen(true);
      result.current.setIsDeleteSeasonOpen(true);
      result.current.setIsEditDialogOpen(true);
      result.current.setIsDeleteDialogOpen(true);
    });

    expect(result.current.isMoveEpisodesOpen).toBe(true);
    expect(result.current.isBatchDeleteOpen).toBe(true);
    expect(result.current.isEditSeriesOpen).toBe(true);
    expect(result.current.isSyncTmdbOpen).toBe(true);
    expect(result.current.isBulkIngestOpen).toBe(true);
    expect(result.current.isEditSeasonOpen).toBe(true);
    expect(result.current.isAddSeasonOpen).toBe(true);
    expect(result.current.isDeleteSeasonOpen).toBe(true);
    expect(result.current.isEditDialogOpen).toBe(true);
    expect(result.current.isDeleteDialogOpen).toBe(true);
  });

  it('handles handleOpenBulkScrape with and without episode IDs', () => {
    const { result } = renderHook(() => useSeriesDetailModals());

    act(() => {
      result.current.handleOpenBulkScrape(['ep-1', 'ep-2']);
    });

    expect(result.current.isBulkScrapeOpen).toBe(true);
    expect(result.current.bulkScrapeEpisodeIds).toEqual(['ep-1', 'ep-2']);

    act(() => {
      result.current.setIsBulkScrapeOpen(false);
      result.current.handleOpenBulkScrape(null);
    });

    expect(result.current.isBulkScrapeOpen).toBe(true);
    expect(result.current.bulkScrapeEpisodeIds).toBeNull();
  });

  it('handles handleOpenManageSources with initial tab', () => {
    const { result } = renderHook(() => useSeriesDetailModals());

    act(() => {
      result.current.handleOpenManageSources('edit-existing');
    });

    expect(result.current.isManageSourcesOpen).toBe(true);
    expect(result.current.manageSourcesInitialTab).toBe('edit-existing');
  });
});
