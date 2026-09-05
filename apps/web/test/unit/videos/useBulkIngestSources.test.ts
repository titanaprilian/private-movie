import { renderHook, createTestQueryClient } from '../../utils';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useBulkIngestSources } from '@/modules/videos/internal/useBulkIngestSources';
import * as api from '@/modules/videos/internal/api';
import type { LocalEpisodeItem, SeasonGroupOption } from '@/modules/videos/internal/useBulkScrapeSources';

const createWrapper = () => {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
};

const mockLocalEpisodes: LocalEpisodeItem[] = [
  { id: 'ep-1', title: 'Episode 1', order: 1, seasonId: 's1' },
  { id: 'ep-2', title: 'Episode 2', order: 2, seasonId: 's1' },
  { id: 'ep-3', title: 'Episode 3', order: 3, seasonId: 's1' },
];

const mockSeasons: SeasonGroupOption[] = [
  {
    id: 's1',
    title: 'Season 1',
    tmdbSeason: 1,
    episodes: mockLocalEpisodes,
  },
];

describe('useBulkIngestSources hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts at step 1 with default inputs', () => {
    const { result } = renderHook(() => useBulkIngestSources(), { wrapper: createWrapper() });

    expect(result.current.step).toBe(1);
    expect(result.current.rawUrlsText).toBe('');
    expect(result.current.defaultLabel).toBe('S3 Video');
    expect(result.current.defaultQuality).toBe('');
    expect(result.current.sharedReferer).toBe('');
    expect(result.current.items).toEqual([]);
  });

  it('validates step 1 requiring at least one valid URL', () => {
    const { result } = renderHook(() => useBulkIngestSources(), { wrapper: createWrapper() });

    act(() => {
      result.current.setRawUrlsText('   \n  \n');
    });

    let success = false;
    act(() => {
      success = result.current.parseUrls();
    });

    expect(success).toBe(false);
    expect(result.current.step).toBe(1);
  });

  it('parses URLs in step 1, auto-detects episode numbers, and maps matching local episodes', () => {
    const { result } = renderHook(
      () => useBulkIngestSources({ seasons: mockSeasons, localEpisodes: mockLocalEpisodes }),
      { wrapper: createWrapper() }
    );

    act(() => {
      const ok = result.current.parseUrls(
        `https://cdn.com/Teach.You.a.Lesson.E01.1080p.mp4\nhttps://cdn.com/show_ep2_720.mkv\nhttps://cdn.com/random_hash_99.mp4`
      );
      expect(ok).toBe(true);
    });

    expect(result.current.step).toBe(2);
    expect(result.current.items.length).toBe(3);

    // Item 0: E01 -> matches ep-1
    const item0 = result.current.items[0];
    expect(item0.detectedEpisodeNumber).toBe(1);
    expect(item0.matchedLocalEpisodeId).toBe('ep-1');
    expect(item0.needsReview).toBe(false);
    expect(item0.quality).toBe('1080p');

    // Item 1: ep2 -> matches ep-2
    const item1 = result.current.items[1];
    expect(item1.detectedEpisodeNumber).toBe(2);
    expect(item1.matchedLocalEpisodeId).toBe('ep-2');
    expect(item1.needsReview).toBe(false);
    expect(item1.quality).toBe('720p');

    // Item 2: hash_99 -> detected 99, but no local ep 99 -> unmatched / needs review
    const item2 = result.current.items[2];
    expect(item2.matchedLocalEpisodeId).toBeNull();
    expect(item2.needsReview).toBe(true);

    // Summary counts
    expect(result.current.totalCount).toBe(3);
    expect(result.current.matchedCount).toBe(2);
    expect(result.current.needsReviewCount).toBe(1);
  });

  it('allows manual combobox re-matching of target episode in step 2', () => {
    const { result } = renderHook(
      () => useBulkIngestSources({ seasons: mockSeasons, localEpisodes: mockLocalEpisodes }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.parseUrls('https://cdn.com/random_hash.mp4');
    });

    expect(result.current.items[0].matchedLocalEpisodeId).toBeNull();
    expect(result.current.items[0].needsReview).toBe(true);

    act(() => {
      result.current.updateMapping(0, 'ep-3');
    });

    expect(result.current.items[0].matchedLocalEpisodeId).toBe('ep-3');
    expect(result.current.items[0].needsReview).toBe(false);
    expect(result.current.matchedCount).toBe(1);
    expect(result.current.needsReviewCount).toBe(0);
  });

  it('allows updating label and quality per row', () => {
    const { result } = renderHook(
      () => useBulkIngestSources({ seasons: mockSeasons, localEpisodes: mockLocalEpisodes }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.parseUrls('https://cdn.com/video.mp4');
    });

    act(() => {
      result.current.updateLabel(0, 'Custom Label');
      result.current.updateQuality(0, '1080p');
    });

    expect(result.current.items[0].label).toBe('Custom Label');
    expect(result.current.items[0].quality).toBe('1080p');
  });

  it('allows toggling include / ignore for a URL row', () => {
    const { result } = renderHook(
      () => useBulkIngestSources({ seasons: mockSeasons, localEpisodes: mockLocalEpisodes }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.parseUrls('https://cdn.com/Teach.You.a.Lesson.E01.1080p.mp4');
    });

    expect(result.current.items[0].isIgnored).toBe(false);

    act(() => {
      result.current.toggleIgnore(0);
    });

    expect(result.current.items[0].isIgnored).toBe(true);
    expect(result.current.matchedCount).toBe(0);
  });

  it('executes sequential ingest queue calling remoteIngestEpisodeVideoSource for each matched item', async () => {
    const ingestSpy = vi.spyOn(api, 'remoteIngestEpisodeVideoSource').mockResolvedValue({
      id: 'ep-1',
      title: 'Episode 1',
      videoSources: [],
      createdAt: '',
      updatedAt: '',
    });

    const { result } = renderHook(
      () => useBulkIngestSources({ seriesId: 'series-1', seasons: mockSeasons, localEpisodes: mockLocalEpisodes }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.setSharedReferer('https://referer-site.com');
      result.current.parseUrls('https://cdn.com/Teach.You.a.Lesson.E01.1080p.mp4');
    });

    await act(async () => {
      await result.current.startIngestQueue();
    });

    expect(ingestSpy).toHaveBeenCalledWith('ep-1', expect.objectContaining({
      url: 'https://cdn.com/Teach.You.a.Lesson.E01.1080p.mp4',
      label: 'S3 1080p',
      quality: '1080p',
      referer: 'https://referer-site.com',
    }));

    expect(result.current.step).toBe(3);
    expect(result.current.items[0].status).toBe('completed');
    expect(result.current.completedCount).toBe(1);
  });

  it('handles per-item ingestion failure gracefully and continues batch execution', async () => {
    const ingestSpy = vi.spyOn(api, 'remoteIngestEpisodeVideoSource')
      .mockRejectedValueOnce(new Error('Network 504 Timeout'))
      .mockResolvedValueOnce({
        id: 'ep-2',
        title: 'Episode 2',
        videoSources: [],
        createdAt: '',
        updatedAt: '',
      });

    const { result } = renderHook(
      () => useBulkIngestSources({ seriesId: 'series-1', seasons: mockSeasons, localEpisodes: mockLocalEpisodes }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.parseUrls(
        `https://cdn.com/Teach.You.a.Lesson.E01.1080p.mp4\nhttps://cdn.com/Teach.You.a.Lesson.E02.1080p.mp4`
      );
    });

    await act(async () => {
      await result.current.startIngestQueue();
    });

    expect(ingestSpy).toHaveBeenCalledTimes(2);

    expect(result.current.items[0].status).toBe('failed');
    expect(result.current.items[0].errorMessage).toBe('Network 504 Timeout');

    expect(result.current.items[1].status).toBe('completed');
    expect(result.current.completedCount).toBe(2);
  });

  it('allows cancelling the ongoing queue process cleanly', async () => {
    vi.spyOn(api, 'remoteIngestEpisodeVideoSource').mockImplementation(
      (_id, options) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );

    const { result } = renderHook(
      () => useBulkIngestSources({ seriesId: 'series-1', seasons: mockSeasons, localEpisodes: mockLocalEpisodes }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.parseUrls('https://cdn.com/Teach.You.a.Lesson.E01.1080p.mp4');
    });

    act(() => {
      result.current.startIngestQueue();
    });

    expect(result.current.isProcessing).toBe(true);

    act(() => {
      result.current.cancelQueue();
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.items[0].status).toBe('failed');
    expect(result.current.items[0].errorMessage).toBe('Cancelled');
  });

  it('resets hook state back to step 1', () => {
    const { result } = renderHook(
      () => useBulkIngestSources({ seasons: mockSeasons, localEpisodes: mockLocalEpisodes }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.parseUrls('https://cdn.com/Teach.You.a.Lesson.E01.1080p.mp4');
    });

    expect(result.current.step).toBe(2);

    act(() => {
      result.current.reset();
    });

    expect(result.current.step).toBe(1);
    expect(result.current.rawUrlsText).toBe('');
    expect(result.current.items).toEqual([]);
  });
});
