import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useBulkScrapeSources, type LocalEpisodeItem } from '@/modules/videos/internal/useBulkScrapeSources';

const mockLocalEpisodes: LocalEpisodeItem[] = [
  { id: 'ep-1', title: 'Episode 1 Title', order: 1, seasonNumber: 1 },
  { id: 'ep-2', title: 'Episode 2 Title', order: 2, seasonNumber: 1 },
  { id: 'ep-3', title: 'Episode 3 Title', order: 3, seasonNumber: 1 },
  { id: 'ep-11', title: 'Episode 11 Title', order: 11, seasonNumber: 1 },
];

describe('useBulkScrapeSources hook', () => {
  it('starts at step 1 with default empty inputs', () => {
    const { result } = renderHook(() => useBulkScrapeSources());

    expect(result.current.step).toBe(1);
    expect(result.current.sourceUrl).toBe('');
    expect(result.current.sourceType).toBe('otakudesu');
    expect(result.current.episodeOffset).toBe(0);
    expect(result.current.previewItems).toEqual([]);
  });

  it('updates inputs correctly', () => {
    const { result } = renderHook(() => useBulkScrapeSources());

    act(() => {
      result.current.setSourceUrl('https://otakudesu.cloud/anime/test');
      result.current.setSourceType('myanimelist');
      result.current.setEpisodeOffset(5);
    });

    expect(result.current.sourceUrl).toBe('https://otakudesu.cloud/anime/test');
    expect(result.current.sourceType).toBe('myanimelist');
    expect(result.current.episodeOffset).toBe(5);
  });

  it('fetches preview and flags decimal episodes (.5) as needing review', () => {
    const { result } = renderHook(() => useBulkScrapeSources());

    act(() => {
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

  it('applies episode offset when calculating matched local episode', () => {
    const { result } = renderHook(() => useBulkScrapeSources());

    act(() => {
      result.current.setEpisodeOffset(10);
    });

    act(() => {
      result.current.fetchPreview(mockLocalEpisodes);
    });

    // Scraped Ep 1 + offset 10 = calculated order 11 -> matches local ep-11!
    const ep1 = result.current.previewItems[0];
    expect(ep1.rawEpisodeNumber).toBe(1);
    expect(ep1.calculatedOrder).toBe(11);
    expect(ep1.matchedLocalEpisodeId).toBe('ep-11');
    expect(ep1.needsReview).toBe(false);
  });

  it('allows updating mapping for a scraped item', () => {
    const { result } = renderHook(() => useBulkScrapeSources());

    act(() => {
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

  it('allows toggling ignore state for a scraped item', () => {
    const { result } = renderHook(() => useBulkScrapeSources());

    act(() => {
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

  it('resets state back to step 1', () => {
    const { result } = renderHook(() => useBulkScrapeSources());

    act(() => {
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
