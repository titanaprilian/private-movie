import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  remoteIngestEpisodeVideoSource,
  type Episode,
} from '@/modules/videos/internal/api';
import { mockFetch, errorResponse } from '../../../utils';

function createSseStream(chunks: string[]): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe('videos api - archive', () => {
  beforeEach(() => {
    mockFetch.reset();
  });

  afterAll(() => {
    mockFetch.restore();
  });

  it('remoteIngestEpisodeVideoSource posts JSON payload and parses SSE stream events', async () => {
    const mockEpisode: Episode = {
      id: 'ep-remote-1',
      sourceUrl: 'https://example.com',
      source: 'direct',
      title: 'Remote Episode',
      videoSources: [
        {
          id: 'src-s3',
          type: 's3',
          url: 'episodes/ep-remote-1/test.mp4',
          label: 'S3 1080p',
          quality: '1080p',
        },
      ],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const sseChunks = [
      'event: progress\ndata: {"loaded":50,"total":100,"percent":50}\n\n',
      'event: complete\ndata: {"episode":' +
        JSON.stringify(mockEpisode) +
        '}\n\n',
    ];

    mockFetch.post('/api/episodes/:id/sources/remote-ingest', () => {
      return new Response(createSseStream(sseChunks), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });

    const progressEvents: number[] = [];
    const res = await remoteIngestEpisodeVideoSource('ep-remote-1', {
      url: 'https://remote.com/video.mp4',
      label: 'S3 1080p',
      quality: '1080p',
      referer: 'https://remote.com',
      onProgress: (p) => {
        progressEvents.push(p.percent);
      },
    });

    const lastReq = mockFetch.lastRequest();
    expect(lastReq?.url.pathname).toContain(
      '/api/episodes/ep-remote-1/sources/remote-ingest'
    );
    expect(lastReq?.bodyJson).toEqual({
      url: 'https://remote.com/video.mp4',
      label: 'S3 1080p',
      quality: '1080p',
      referer: 'https://remote.com',
    });
    expect(progressEvents).toEqual([50]);
    expect(res.id).toBe('ep-remote-1');
  });

  it('remoteIngestEpisodeVideoSource surfaces error code on non-2xx response', async () => {
    mockFetch.post(
      '/api/episodes/:id/sources/remote-ingest',
      errorResponse('S3 storage service is not configured', 503, {
        code: 'S3_NOT_CONFIGURED',
      })
    );

    const err = await remoteIngestEpisodeVideoSource('ep-remote-1', {
      url: 'https://remote.com/video.mp4',
      label: 'S3 1080p',
    }).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error & { code?: string }).code).toBe('S3_NOT_CONFIGURED');
  });

  it('remoteIngestEpisodeVideoSource parses trailing complete event block without trailing double newline when stream ends', async () => {
    const mockEpisode: Episode = {
      id: 'ep-trailing-1',
      sourceUrl: 'https://example.com',
      source: 'direct',
      title: 'Trailing Episode',
      videoSources: [
        {
          id: 'src-s3-trailing',
          type: 's3',
          url: 'episodes/ep-trailing-1/test.mp4',
          label: 'S3 1080p',
          quality: '1080p',
        },
      ],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const sseChunks = [
      'event: progress\ndata: {"loaded":50,"total":100,"percent":50}\n\n',
      'event: complete\ndata: {"episode":' + JSON.stringify(mockEpisode) + '}',
    ];

    mockFetch.post('/api/episodes/:id/sources/remote-ingest', () => {
      return new Response(createSseStream(sseChunks), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });

    const res = await remoteIngestEpisodeVideoSource('ep-trailing-1', {
      url: 'https://remote.com/video.mp4',
      label: 'S3 1080p',
    });

    expect(res.id).toBe('ep-trailing-1');
  });

  it('remoteIngestEpisodeVideoSource parses trailing error event block without trailing double newline when stream ends', async () => {
    const sseChunks = [
      'event: progress\ndata: {"loaded":10,"total":100,"percent":10}\n\n',
      'event: error\ndata: {"code":"INGEST_FAILED","message":"S3 multipart upload failed"}',
    ];

    mockFetch.post('/api/episodes/:id/sources/remote-ingest', () => {
      return new Response(createSseStream(sseChunks), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });

    const err = await remoteIngestEpisodeVideoSource('ep-trailing-err', {
      url: 'https://remote.com/video.mp4',
      label: 'S3 1080p',
    }).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('S3 multipart upload failed');
    expect((err as Error & { code?: string }).code).toBe('INGEST_FAILED');
  });
});
