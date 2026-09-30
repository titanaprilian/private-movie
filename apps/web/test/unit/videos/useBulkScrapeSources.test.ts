import { renderHook, createTestQueryClient } from '../../utils';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  useBulkScrapeSources,
  getTargetSeasonEpisodes,
  applyPreviewSequentialFallback,
  type LocalEpisodeItem,
} from '@/modules/videos/internal/useBulkScrapeSources';
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
  it('starts at step 1 with default empty inputs and no offset state', () => {
    const { result } = renderHook(() => useBulkScrapeSources(), { wrapper: createWrapper() });

    expect(result.current.step).toBe(1);
    expect(result.current.sourceUrl).toBe('');
    expect(result.current.sourceType).toBe('otakudesu');
    expect('episodeOffset' in result.current).toBe(false);
    expect('seasonOffsetHelperText' in result.current).toBe(false);
    expect(result.current.previewItems).toEqual([]);
  });

  it('updates inputs correctly', () => {
    const { result } = renderHook(() => useBulkScrapeSources(), { wrapper: createWrapper() });

    act(() => {
      result.current.setSourceUrl('https://otakudesu.cloud/anime/test');
      result.current.setSourceType('myanimelist');
    });

    expect(result.current.sourceUrl).toBe('https://otakudesu.cloud/anime/test');
    expect(result.current.sourceType).toBe('myanimelist');
  });

  describe('Source type auto-detect from URL', () => {
    it('auto-selects dramula when the URL contains dramula', () => {
      const { result } = renderHook(() => useBulkScrapeSources(), { wrapper: createWrapper() });

      act(() => {
        result.current.setSourceUrl('https://dramula.example.com/season-1');
      });

      expect(result.current.sourceUrl).toBe('https://dramula.example.com/season-1');
      expect(result.current.sourceType).toBe('dramula');
    });

    it('auto-selects otakudesu when the URL contains otakudesu', () => {
      const { result } = renderHook(() => useBulkScrapeSources(), { wrapper: createWrapper() });

      act(() => {
        result.current.setSourceType('direct');
      });
      act(() => {
        result.current.setSourceUrl('https://otakudesu.cloud/anime/test');
      });

      expect(result.current.sourceType).toBe('otakudesu');
    });

    it('leaves the manual selection untouched for unrecognized URLs', () => {
      const { result } = renderHook(() => useBulkScrapeSources(), { wrapper: createWrapper() });

      act(() => {
        result.current.setSourceType('direct');
      });
      act(() => {
        result.current.setSourceUrl('https://cdn.example.com/video.mp4');
      });

      expect(result.current.sourceType).toBe('direct');
    });

    it('keeps a manual selection made after typing the URL', () => {
      const { result } = renderHook(() => useBulkScrapeSources(), { wrapper: createWrapper() });

      act(() => {
        result.current.setSourceUrl('https://dramula.example.com/season-1');
      });
      expect(result.current.sourceType).toBe('dramula');

      act(() => {
        result.current.setSourceType('embed');
      });
      expect(result.current.sourceType).toBe('embed');
    });
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

  it('matches scraped episodes 1:1 by order with no offset applied', async () => {
    const { result } = renderHook(() => useBulkScrapeSources(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.fetchPreview(mockLocalEpisodes);
    });

    // Scraped Ep 1 maps directly to local ep with order 1
    const ep1 = result.current.previewItems[0];
    expect(ep1.rawEpisodeNumber).toBe(1);
    expect(ep1.calculatedOrder).toBe(1);
    expect(ep1.matchedLocalEpisodeId).toBe('ep-1');
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
          hasSources: false,
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
      seasonId: undefined,
    });

    expect(result.current.step).toBe(2);
    expect(result.current.previewItems[0].scrapedTitle).toBe('Live Ep 1');
    previewSpy.mockRestore();
  });

  it('passes selectedSeasonId into live previewBulkSources API call when seasons are provided', async () => {
    const previewSpy = vi.spyOn(api, 'previewBulkSources').mockResolvedValueOnce({
      scrapedEpisodes: [
        {
          scrapedTitle: 'Live Ep 1',
          scrapedUrl: 'https://otakudesu.cloud/ep1',
          episodeNumber: 1,
          calculatedOrder: 1,
          matchedLocalEpisodeId: 'ep-s2-1',
          matchStatus: 'matched',
        },
      ],
      localEpisodes: [
        {
          id: 'ep-s2-1',
          title: 'Season 2 Ep 1',
          order: 1,
          seasonId: 'season-2',
          seasonNumber: 2,
          seasonTitle: 'Season 2',
          hasSources: false,
        },
      ],
    });

    const mockSeasons = [
      { id: 'season-1', title: 'Season 1', episodes: [{ id: 'ep-s1-1', title: 'S1 E1', order: 1 }] },
      { id: 'season-2', title: 'Season 2', episodes: [{ id: 'ep-s2-1', title: 'S2 E1', order: 1 }] },
    ];

    const { result } = renderHook(
      () => useBulkScrapeSources({ seriesId: 'series-100', seasons: mockSeasons }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.selectSeason('season-2');
      result.current.setSourceUrl('https://otakudesu.cloud/anime/season-2');
    });

    await act(async () => {
      result.current.fetchPreview();
    });

    expect(previewSpy).toHaveBeenCalledWith({
      seriesId: 'series-100',
      sourceUrl: 'https://otakudesu.cloud/anime/season-2',
      source: 'otakudesu',
      episodeOffset: 0,
      seasonId: 'season-2',
    });

    previewSpy.mockRestore();
  });

  it('calls live scrapeEpisodeSources API for each matched item when saveBulkSources is triggered', async () => {
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

    const scrapeSpy = vi.spyOn(api, 'scrapeEpisodeSources').mockResolvedValueOnce({
      id: 'ep-1',
      title: 'Live Ep 1',
      videoSources: [],
      createdAt: '',
      updatedAt: '',
    });

    const { result } = renderHook(() => useBulkScrapeSources({ seriesId: 'series-100' }), { wrapper: createWrapper() });

    await act(async () => {
      result.current.fetchPreview();
    });

    await act(async () => {
      await result.current.saveBulkSources();
    });

    expect(scrapeSpy).toHaveBeenCalledWith('ep-1', 'https://otakudesu.cloud/ep1');
    previewSpy.mockRestore();
    scrapeSpy.mockRestore();
  });

  it('handles per-item scrape network failure gracefully without stopping batch execution', async () => {
    const previewSpy = vi.spyOn(api, 'previewBulkSources').mockResolvedValueOnce({
      scrapedEpisodes: [
        {
          scrapedTitle: 'Ep 1',
          scrapedUrl: 'https://otakudesu.cloud/ep1',
          episodeNumber: 1,
          calculatedOrder: 1,
          matchedLocalEpisodeId: 'ep-1',
          matchStatus: 'matched',
        },
        {
          scrapedTitle: 'Ep 2',
          scrapedUrl: 'https://otakudesu.cloud/ep2',
          episodeNumber: 2,
          calculatedOrder: 2,
          matchedLocalEpisodeId: 'ep-2',
          matchStatus: 'matched',
        },
      ],
      localEpisodes: [],
    });

    const scrapeSpy = vi.spyOn(api, 'scrapeEpisodeSources')
      .mockRejectedValueOnce(new Error('Scrape Connection Timeout'))
      .mockResolvedValueOnce({
        id: 'ep-2',
        title: 'Ep 2',
        videoSources: [],
        createdAt: '',
        updatedAt: '',
      });

    const { result } = renderHook(() => useBulkScrapeSources({ seriesId: 'series-100' }), { wrapper: createWrapper() });

    await act(async () => {
      result.current.fetchPreview();
    });

    await act(async () => {
      await result.current.saveBulkSources();
    });

    expect(scrapeSpy).toHaveBeenCalledTimes(2);

    const ep1Log = result.current.processingLogs.find((l) => l.scrapedTitle === 'Ep 1');
    expect(ep1Log?.status).toBe('error');
    expect(ep1Log?.message).toContain('Scrape Connection Timeout');

    const ep2Log = result.current.processingLogs.find((l) => l.scrapedTitle === 'Ep 2');
    expect(ep2Log?.status).toBe('success');

    previewSpy.mockRestore();
    scrapeSpy.mockRestore();
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
      result.current.fetchPreview(mockLocalEpisodes);
    });

    expect(result.current.step).toBe(2);

    act(() => {
      result.current.reset();
    });

    expect(result.current.step).toBe(1);
    expect(result.current.sourceUrl).toBe('');
    expect('episodeOffset' in result.current).toBe(false);
    expect(result.current.previewItems).toEqual([]);
    expect(result.current.processingLogs).toEqual([]);
    expect(result.current.completedCount).toBe(0);
    expect(result.current.progress).toBe(0);
  });

  it('transitions to step 3 and performs sequential batch processing', async () => {
    const scrapeSpy = vi.spyOn(api, 'scrapeEpisodeSources').mockResolvedValue({
      id: 'ep-2',
      title: 'Episode 2',
      videoSources: [],
      createdAt: '',
      updatedAt: '',
    });

    const { result } = renderHook(() => useBulkScrapeSources(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.fetchPreview(mockLocalEpisodes);
    });

    expect(result.current.step).toBe(2);

    act(() => {
      result.current.toggleIgnore(0);
    });

    await act(async () => {
      await result.current.saveBulkSources();
    });

    expect(result.current.step).toBe(3);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.progress).toBe(100);
    expect(result.current.totalCount).toBe(4);
    expect(result.current.completedCount).toBe(4);

    const ep1Log = result.current.processingLogs.find((l) => l.scrapedTitle === 'Episode 1');
    expect(ep1Log?.status).toBe('skipped');

    const ep2Log = result.current.processingLogs.find((l) => l.scrapedTitle === 'Episode 2');
    expect(ep2Log?.status).toBe('success');

    scrapeSpy.mockRestore();
  });

  describe('Target Season selection (no offset)', () => {    const mockSeasonsList = [
      {
        id: 's1',
        title: 'Season 1',
        tmdbSeason: 1,
        episodes: [
          { id: 'ep-1', title: 'Ep 1', order: 1 },
          { id: 'ep-2', title: 'Ep 2', order: 2 },
        ],
      },
      {
        id: 's2',
        title: 'Season 2',
        tmdbSeason: 2,
        episodes: [
          { id: 'ep-13', title: 'Ep 13', order: 13 },
          { id: 'ep-14', title: 'Ep 14', order: 14 },
        ],
      },
    ];

    it('auto-selects first season by default with no offset state exposed', () => {
      const { result } = renderHook(
        () => useBulkScrapeSources({ seasons: mockSeasonsList }),
        { wrapper: createWrapper() }
      );

      expect(result.current.selectedSeasonId).toBe('s1');
      expect('episodeOffset' in result.current).toBe(false);
      expect('seasonOffsetHelperText' in result.current).toBe(false);
    });

    it('switches selected season without touching any offset', () => {
      const { result } = renderHook(
        () => useBulkScrapeSources({ seasons: mockSeasonsList }),
        { wrapper: createWrapper() }
      );

      act(() => {
        result.current.selectSeason('s2');
      });

      expect(result.current.selectedSeasonId).toBe('s2');
      expect('episodeOffset' in result.current).toBe(false);
    });

    it('derives season options from localEpisodes when seasons list is absent', () => {
      const flatLocalEpisodes: LocalEpisodeItem[] = [
        { id: 'ep-13', title: 'Ep 13', order: 13, seasonId: 's2', seasonTitle: 'Season 2', seasonNumber: 2 },
        { id: 'ep-14', title: 'Ep 14', order: 14, seasonId: 's2', seasonTitle: 'Season 2', seasonNumber: 2 },
      ];

      const { result } = renderHook(
        () => useBulkScrapeSources({ localEpisodes: flatLocalEpisodes }),
        { wrapper: createWrapper() }
      );

      expect(result.current.selectedSeasonId).toBe('s2');
      expect(result.current.seasonOptions).toEqual([{ id: 's2', label: 'Season 2' }]);
    });
  });

  describe('Sequential fallback matching', () => {
    const season2 = [
      {
        id: 's2',
        title: 'Season 2',
        tmdbSeason: 2,
        episodes: [
          { id: 'ep-13', title: 'S2 Ep 1', order: 13 },
          { id: 'ep-14', title: 'S2 Ep 2', order: 14 },
        ],
      },
    ];

    it('defaults unmatched integer episodes to sequential order within the target season', async () => {
      const { result } = renderHook(
        () => useBulkScrapeSources({ seasons: season2 }),
        { wrapper: createWrapper() }
      );

      // No local episodes passed, so title matching finds nothing;
      // fallback maps scraped Ep 1/2 to the first unclaimed season targets.
      await act(async () => {
        result.current.fetchPreview([]);
      });

      const items = result.current.previewItems;
      expect(items[0].matchedLocalEpisodeId).toBe('ep-13');
      expect(items[0].calculatedOrder).toBe(13);
      expect(items[0].needsReview).toBe(false);
      expect(items[1].matchedLocalEpisodeId).toBe('ep-14');
      // Decimal episode stays unmapped and needs review
      expect(items[2].matchedLocalEpisodeId).toBeNull();
      expect(items[2].needsReview).toBe(true);
      // Excess item beyond season length stays unmapped
      expect(items[3].matchedLocalEpisodeId).toBeNull();
      expect(items[3].needsReview).toBe(true);
    });

    it('exposes target season episodes in ascending order', () => {
      const { result } = renderHook(
        () => useBulkScrapeSources({ seasons: season2 }),
        { wrapper: createWrapper() }
      );

      expect(result.current.targetSeasonEpisodes.map((e) => e.id)).toEqual([
        'ep-13',
        'ep-14',
      ]);
    });

    it('getTargetSeasonEpisodes filters flat local episodes by season id', () => {
      const flat: LocalEpisodeItem[] = [
        { id: 'ep-1', title: 'S1 E1', order: 1, seasonId: 's1' },
        { id: 'ep-13', title: 'S2 E1', order: 1, seasonId: 's2' },
      ];
      expect(getTargetSeasonEpisodes(undefined, flat, 's2').map((e) => e.id)).toEqual([
        'ep-13',
      ]);
      expect(getTargetSeasonEpisodes(undefined, flat, 'unknown')).toEqual([]);
    });

    it('applyPreviewSequentialFallback leaves decimals and excess items unmapped', () => {
      const mk = (
        order: number | null,
        matched: string | null = null
      ) => ({
        id: `scraped-${order}`,
        scrapedTitle: `Episode ${order}`,
        rawEpisodeNumber: order ?? 'x',
        calculatedOrder: order,
        matchedLocalEpisodeId: matched,
        isIgnored: false,
        needsReview: matched === null,
        videoSources: [],
      });
      const result = applyPreviewSequentialFallback(
        [mk(1), mk(7.5), mk(2), mk(3)],
        [
          { id: 'ep-1', order: 1 },
          { id: 'ep-2', order: 2 },
        ]
      );
      expect(result[0].matchedLocalEpisodeId).toBe('ep-1');
      expect(result[1].matchedLocalEpisodeId).toBeNull();
      expect(result[2].matchedLocalEpisodeId).toBe('ep-2');
      expect(result[3].matchedLocalEpisodeId).toBeNull();
    });
  });

  describe('1-click sequential auto-align', () => {
    const season2 = [
      {
        id: 's2',
        title: 'Season 2',
        tmdbSeason: 2,
        episodes: [
          { id: 'ep-13', title: 'S2 Ep 1', order: 13 },
          { id: 'ep-14', title: 'S2 Ep 2', order: 14 },
        ],
      },
    ];

    it('maps scraped items 1:1 down the target season, leaving excess unmapped', async () => {
      const { result } = renderHook(
        () => useBulkScrapeSources({ seasons: season2 }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.fetchPreview([]);
      });

      // Scramble one mapping first to prove auto-align overwrites everything
      act(() => {
        result.current.updateMapping(0, null);
      });
      expect(result.current.previewItems[0].matchedLocalEpisodeId).toBeNull();

      act(() => {
        result.current.autoAlignSequentially();
      });

      const items = result.current.previewItems;
      expect(items[0].matchedLocalEpisodeId).toBe('ep-13');
      expect(items[0].needsReview).toBe(false);
      expect(items[1].matchedLocalEpisodeId).toBe('ep-14');
      expect(items[1].needsReview).toBe(false);
      expect(items[2].matchedLocalEpisodeId).toBeNull();
      expect(items[2].needsReview).toBe(true);
      expect(items[3].matchedLocalEpisodeId).toBeNull();
      expect(items[3].needsReview).toBe(true);
    });
  });

  describe('Overwrite conflict tracking', () => {
    const mockEpisodesWithSources: LocalEpisodeItem[] = [
      { id: 'ep-1', title: 'Episode 1 Title', order: 1, seasonNumber: 1, hasSources: true },
      { id: 'ep-2', title: 'Episode 2 Title', order: 2, seasonNumber: 1, hasSources: false },
    ];

    it('identifies if a local episode has existing sources', () => {
      const { result } = renderHook(
        () => useBulkScrapeSources({ localEpisodes: mockEpisodesWithSources }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isEpisodeHasSources('ep-1')).toBe(true);
      expect(result.current.isEpisodeHasSources('ep-2')).toBe(false);
      expect(result.current.isEpisodeHasSources('ep-999')).toBe(false);
    });

    it('identifies episode sources using videoSources array when hasSources is undefined', () => {
      const mockEpisodesWithVideoSources = [
        { id: 'ep-10', title: 'Ep 10', order: 1, videoSources: [{ type: 'otakudesu', url: 'http://ep10' }] },
        { id: 'ep-20', title: 'Ep 20', order: 2, videoSources: [] },
      ];

      const { result } = renderHook(
        () => useBulkScrapeSources({ localEpisodes: mockEpisodesWithVideoSources }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isEpisodeHasSources('ep-10')).toBe(true);
      expect(result.current.isEpisodeHasSources('ep-20')).toBe(false);
    });

    it('correctly sets hasOverwriteConflicts when mapped items point to local episodes with existing sources', async () => {
      const { result } = renderHook(
        () => useBulkScrapeSources({ localEpisodes: mockEpisodesWithSources }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.fetchPreview(mockEpisodesWithSources);
      });

      // Ep 1 maps to ep-1 which hasSources: true
      expect(result.current.hasOverwriteConflicts).toBe(true);

      // If we ignore Ep 1, conflict should clear
      act(() => {
        result.current.toggleIgnore(0);
      });

      expect(result.current.hasOverwriteConflicts).toBe(false);
    });
  });
});

