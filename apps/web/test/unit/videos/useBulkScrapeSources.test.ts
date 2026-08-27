import { renderHook, createTestQueryClient } from '../../utils';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBulkScrapeSources, type LocalEpisodeItem } from '@/modules/videos/internal/useBulkScrapeSources';
import * as api from '@/modules/videos/internal/api';

const createWrapper = () => {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
};

const mockLocalEpisodes: LocalEpisodeItem[] = [
  { id: 'ep-1', title: 'Episode 1 Title', order: 1, seasonNumber: 1 },
  { id: 'ep-2', title: 'Episode 2 Title', order: 2, seasonNumber: 1 },
  { id: 'ep-3', title: 'Episode 3 Title', order: 3, seasonNumber: 1 },
  { id: 'ep-11', title: 'Episode 11 Title', order: 11, seasonNumber: 1 },
];

describe('useBulkScrapeSources hook', () => {
  it('starts at step 1 with default empty inputs', () => {
    const { result } = renderHook(() => useBulkScrapeSources(), { wrapper: createWrapper() });

    expect(result.current.step).toBe(1);
    expect(result.current.sourceUrl).toBe('');
    expect(result.current.sourceType).toBe('otakudesu');
    expect(result.current.episodeOffset).toBe(0);
    expect(result.current.previewItems).toEqual([]);
  });

  it('updates inputs correctly', () => {
    const { result } = renderHook(() => useBulkScrapeSources(), { wrapper: createWrapper() });

    act(() => {
      result.current.setSourceUrl('https://otakudesu.cloud/anime/test');
      result.current.setSourceType('myanimelist');
      result.current.setEpisodeOffset(5);
    });

    expect(result.current.sourceUrl).toBe('https://otakudesu.cloud/anime/test');
    expect(result.current.sourceType).toBe('myanimelist');
    expect(result.current.episodeOffset).toBe(5);
  });

  it('fetches preview and flags decimal episodes (.5) as needing review', async () => {
    const { result } = renderHook(() => useBulkScrapeSources(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.setSourceUrl('https://otakudesu.cloud/anime/test');
      result.current.fetchPreview(mockLocalEpisodes);
    });

    expect(result.current.step).toBe(2);
    expect(result.current.previewItems.length).toBe(4);

    // Ep 1 matches local ep-1
    const ep1 = result.current.previewItems[0];
    expect(ep1.rawEpisodeNumber).toBe(1);
    expect(ep1.calculatedOrder).toBe(1);
    expect(ep1.matchedLocalEpisodeId).toBe('ep-1');
    expect(ep1.needsReview).toBe(false);

    // Ep 7.5 decimal non-integer episode needs review
    const epDecimal = result.current.previewItems[2];
    expect(epDecimal.rawEpisodeNumber).toBe(7.5);
    expect(epDecimal.calculatedOrder).toBeNull();
    expect(epDecimal.matchedLocalEpisodeId).toBeNull();
    expect(epDecimal.needsReview).toBe(true);
  });

  it('applies episode offset when calculating matched local episode', async () => {
    const { result } = renderHook(() => useBulkScrapeSources(), { wrapper: createWrapper() });

    act(() => {
      result.current.setEpisodeOffset(10);
    });

    await act(async () => {
      result.current.fetchPreview(mockLocalEpisodes);
    });

    // Scraped Ep 1 + offset 10 = calculated order 11 -> matches local ep-11!
    const ep1 = result.current.previewItems[0];
    expect(ep1.rawEpisodeNumber).toBe(1);
    expect(ep1.calculatedOrder).toBe(11);
    expect(ep1.matchedLocalEpisodeId).toBe('ep-11');
    expect(ep1.needsReview).toBe(false);
  });

  it('calls live previewBulkSources API when seriesId is provided', async () => {
    const previewSpy = vi.spyOn(api, 'previewBulkSources').mockResolvedValueOnce({
      scrapedEpisodes: [
        {
          scrapedTitle: 'Live Ep 1',
          scrapedUrl: 'https://otakudesu.cloud/ep1',
          episodeNumber: 1,
          calculatedOrder: 1,
          matchedLocalEpisodeId: 'ep-1',
          matchStatus: 'matched',
        },
      ],
      localEpisodes: [
        {
          id: 'ep-1',
          title: 'Live Local Ep 1',
          order: 1,
          seasonId: 'season-1',
          seasonNumber: 1,
          seasonTitle: 'Season 1',
        },
      ],
    });

    const { result } = renderHook(() => useBulkScrapeSources({ seriesId: 'series-100' }), { wrapper: createWrapper() });

    act(() => {
      result.current.setSourceUrl('https://otakudesu.cloud/anime/test');
    });

    await act(async () => {
      result.current.fetchPreview();
    });

    expect(previewSpy).toHaveBeenCalledWith({
      seriesId: 'series-100',
      sourceUrl: 'https://otakudesu.cloud/anime/test',
      source: 'otakudesu',
      episodeOffset: 0,
    });

    expect(result.current.step).toBe(2);
    expect(result.current.previewItems[0].scrapedTitle).toBe('Live Ep 1');
    previewSpy.mockRestore();
  });

  it('calls live saveBulkSources API when saveBulkSources is triggered', async () => {
    const previewSpy = vi.spyOn(api, 'previewBulkSources').mockResolvedValueOnce({
      scrapedEpisodes: [
        {
          scrapedTitle: 'Live Ep 1',
          scrapedUrl: 'https://otakudesu.cloud/ep1',
          episodeNumber: 1,
          calculatedOrder: 1,
          matchedLocalEpisodeId: 'ep-1',
          matchStatus: 'matched',
        },
      ],
      localEpisodes: [],
    });

    const saveSpy = vi.spyOn(api, 'saveBulkSources').mockResolvedValueOnce({
      success: true,
      savedCount: 1,
      skippedCount: 0,
    });

    const { result } = renderHook(() => useBulkScrapeSources({ seriesId: 'series-100' }), { wrapper: createWrapper() });

    await act(async () => {
      result.current.fetchPreview();
    });

    await act(async () => {
      await result.current.saveBulkSources();
    });

    expect(saveSpy).toHaveBeenCalledWith({
      seriesId: 'series-100',
      mappings: expect.arrayContaining([
        expect.objectContaining({
          episodeId: 'ep-1',
        }),
      ]),
    });
    previewSpy.mockRestore();
    saveSpy.mockRestore();
  });

  it('allows updating mapping for a scraped item', async () => {
    const { result } = renderHook(() => useBulkScrapeSources(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.fetchPreview(mockLocalEpisodes);
    });

    // Ep 7.5 (index 2) was unmapped and needed review
    expect(result.current.previewItems[2].needsReview).toBe(true);

    act(() => {
      result.current.updateMapping(2, 'ep-3');
    });

    expect(result.current.previewItems[2].matchedLocalEpisodeId).toBe('ep-3');
    expect(result.current.previewItems[2].needsReview).toBe(false);
  });

  it('allows toggling ignore state for a scraped item', async () => {
    const { result } = renderHook(() => useBulkScrapeSources(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.fetchPreview(mockLocalEpisodes);
    });

    expect(result.current.previewItems[0].isIgnored).toBe(false);

    act(() => {
      result.current.toggleIgnore(0);
    });

    expect(result.current.previewItems[0].isIgnored).toBe(true);

    act(() => {
      result.current.toggleIgnore(0);
    });

    expect(result.current.previewItems[0].isIgnored).toBe(false);
  });

  it('resets state back to step 1', async () => {
    const { result } = renderHook(() => useBulkScrapeSources(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.setSourceUrl('https://example.com');
      result.current.setEpisodeOffset(2);
      result.current.fetchPreview(mockLocalEpisodes);
    });

    expect(result.current.step).toBe(2);

    act(() => {
      result.current.reset();
    });

    expect(result.current.step).toBe(1);
    expect(result.current.sourceUrl).toBe('');
    expect(result.current.episodeOffset).toBe(0);
    expect(result.current.previewItems).toEqual([]);
  });
});

