import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useArchiveIngestReview } from '@/modules/videos/internal/ingestion/bulk/hooks/useArchiveIngestReview';
import type { ArchiveIngestJob } from '@repo/contracts';

function makeJob(overrides: Partial<ArchiveIngestJob> = {}): ArchiveIngestJob {
  return {
    id: 'job-1',
    ownerId: 'owner-1',
    seriesId: 'series-1',
    sourceKey: 'https://example.com/pack.zip',
    sourceUrl: 'https://example.com/pack.zip',
    referer: null,
    status: 'ready',
    stage: 'ready',
    bytesDone: 0,
    bytesTotal: null,
    stagingPath: null,
    archiveFilename: null,
    entries: [],
    selection: [],
    storageProviderId: null,
    errorCode: null,
    errorMessage: null,
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:00:00.000Z',
    expiresAt: null,
    ...overrides,
  };
}

const localEpisodes = [
  { id: 'ep-1', title: 'Episode 1', order: 1, seasonId: 's1' },
  { id: 'ep-2', title: 'Episode 2', order: 2, seasonId: 's1' },
];

describe('useArchiveIngestReview hook', () => {
  it('returns empty review items when job is null', () => {
    const { result } = renderHook(() =>
      useArchiveIngestReview({
        job: null,
        availableLocalEpisodes: localEpisodes,
      })
    );
    expect(result.current.reviewItems).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.matchedCount).toBe(0);
    expect(result.current.needsReviewCount).toBe(0);
  });

  it('matches local episodes by detected episode number and computes review status', () => {
    const job = makeJob({
      entries: [
        {
          filename: 'ep01.mp4',
          sizeBytes: 1000,
          detectedEpisodeNumber: 1,
          quality: '1080p',
          needsReview: false,
        },
        {
          filename: 'unknown.mp4',
          sizeBytes: 1000,
          detectedEpisodeNumber: null,
          quality: null,
          needsReview: true,
        },
      ],
    });

    const { result } = renderHook(() =>
      useArchiveIngestReview({ job, availableLocalEpisodes: localEpisodes })
    );

    expect(result.current.totalCount).toBe(2);
    expect(result.current.matchedCount).toBe(1);
    expect(result.current.needsReviewCount).toBe(1);

    const items = result.current.reviewItems;
    expect(items[0].filename).toBe('ep01.mp4');
    expect(items[0].matchedEpisodeId).toBe('ep-1');
    expect(items[0].needsReview).toBe(false);

    expect(items[1].filename).toBe('unknown.mp4');
    expect(items[1].matchedEpisodeId).toBeNull();
    expect(items[1].needsReview).toBe(true);
  });

  it('allows updating episode mapping, label, quality, and ignore flag', () => {
    const job = makeJob({
      entries: [
        {
          filename: 'file.mp4',
          sizeBytes: 500,
          detectedEpisodeNumber: null,
          quality: null,
          needsReview: true,
        },
      ],
    });

    const { result } = renderHook(() =>
      useArchiveIngestReview({ job, availableLocalEpisodes: localEpisodes })
    );

    expect(result.current.reviewItems[0].matchedEpisodeId).toBeNull();
    expect(result.current.reviewItems[0].needsReview).toBe(true);

    act(() => {
      result.current.updateReviewMapping(0, 'ep-2');
    });
    expect(result.current.reviewItems[0].matchedEpisodeId).toBe('ep-2');
    expect(result.current.reviewItems[0].needsReview).toBe(false);

    act(() => {
      result.current.updateReviewLabel(0, 'Custom Label');
      result.current.updateReviewQuality(0, '720p');
    });
    expect(result.current.reviewItems[0].label).toBe('Custom Label');
    expect(result.current.reviewItems[0].quality).toBe('720p');

    act(() => {
      result.current.toggleReviewIgnore(0);
    });
    expect(result.current.reviewItems[0].isIgnored).toBe(true);
    expect(result.current.reviewItems[0].needsReview).toBe(false);

    act(() => {
      result.current.resetReview();
    });
    expect(result.current.reviewItems[0].matchedEpisodeId).toBeNull();
    expect(result.current.reviewItems[0].isIgnored).toBe(false);
  });

  it('computes commit completed counts and active commit items', () => {
    const job = makeJob({
      status: 'uploading',
      stage: 'uploading 1/2: ep01.mp4',
      entries: [
        { filename: 'ep01.mp4', sizeBytes: 1000, detectedEpisodeNumber: 1 },
        { filename: 'ep02.mp4', sizeBytes: 1000, detectedEpisodeNumber: 2 },
      ],
      selection: [
        {
          filename: 'ep01.mp4',
          episodeId: 'ep-1',
          isIgnored: false,
          completed: false,
        },
        {
          filename: 'ep02.mp4',
          episodeId: 'ep-2',
          isIgnored: false,
          completed: true,
        },
      ],
    });

    const { result } = renderHook(() =>
      useArchiveIngestReview({ job, availableLocalEpisodes: localEpisodes })
    );

    expect(result.current.commitCompletedCount).toBe(1);
    expect(result.current.activeCommitItem?.filename).toBe('ep01.mp4');
  });
});
