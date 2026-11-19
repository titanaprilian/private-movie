import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  presignUploadSource,
  uploadBinaryToS3,
  uploadEpisodeVideoSource,
  getUploadProgress,
} from '@/modules/videos/internal/api';
import { mockFetch } from '../../../utils';

interface MockXhrOptions {
  status?: number;
  responseText?: string;
  onSend?: (xhr: MockXhrInstance) => void;
}

interface MockXhrInstance {
  open: ReturnType<typeof vi.fn>;
  setRequestHeader: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  upload: {
    onprogress?:
      | ((event: {
          lengthComputable: boolean;
          loaded: number;
          total: number;
        }) => void)
      | null;
  };
  status: number;
  responseText: string;
  withCredentials: boolean;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
}

function createMockXhr(options: MockXhrOptions = {}): MockXhrInstance {
  const instance: MockXhrInstance = {
    open: vi.fn(),
    setRequestHeader: vi.fn(),
    send: vi.fn(function () {
      if (options.onSend) {
        options.onSend(instance);
      } else {
        instance.status = options.status ?? 200;
        instance.responseText = options.responseText ?? '';
        instance.onload?.();
      }
    }),
    abort: vi.fn(function () {
      instance.onabort?.();
    }),
    upload: {},
    status: options.status ?? 0,
    responseText: options.responseText ?? '',
    withCredentials: false,
    onload: null,
    onerror: null,
    onabort: null,
  };
  return instance;
}

describe('videos api - upload', () => {
  let xhrSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    mockFetch.reset();
  });

  afterEach(() => {
    if (xhrSpy) {
      xhrSpy.mockRestore();
      xhrSpy = null;
    }
  });

  afterAll(() => {
    mockFetch.restore();
  });

  it('presignUploadSource posts to /episodes/:id/sources/presign-upload', async () => {
    const mockData = {
      data: {
        uploadUrl: 'https://s3.example.com/presigned-put',
        key: 'episodes/ep-1/test.mp4',
      },
    };

    mockFetch.post('/api/episodes/:id/sources/presign-upload', mockData);

    const res = await presignUploadSource('ep-1', {
      filename: 'test.mp4',
      contentType: 'video/mp4',
    });

    const lastReq = mockFetch.lastRequest();
    expect(lastReq?.url.pathname).toContain(
      '/episodes/ep-1/sources/presign-upload'
    );
    expect(lastReq?.bodyJson).toEqual({
      filename: 'test.mp4',
      contentType: 'video/mp4',
    });
    expect(res.uploadUrl).toBe('https://s3.example.com/presigned-put');
    expect(res.key).toBe('episodes/ep-1/test.mp4');
  });

  it('uploadBinaryToS3 executes XMLHttpRequest PUT, emits progress, and completes', async () => {
    const file = new File(['fake video content'], 'test.mp4', {
      type: 'video/mp4',
    });
    const progressEvents: number[] = [];

    const mockXhr = createMockXhr({
      onSend: (xhr) => {
        xhr.upload.onprogress?.({
          lengthComputable: true,
          loaded: 50,
          total: 100,
        });
        xhr.upload.onprogress?.({
          lengthComputable: true,
          loaded: 100,
          total: 100,
        });
        xhr.status = 200;
        xhr.onload?.();
      },
    });

    xhrSpy = vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function () {
      return mockXhr as unknown as XMLHttpRequest;
    } as unknown as () => XMLHttpRequest);

    await uploadBinaryToS3({
      url: 'https://s3.example.com/put-url',
      file,
      onProgress: (p) => {
        progressEvents.push(p.percent);
      },
    });

    expect(mockXhr.open).toHaveBeenCalledWith(
      'PUT',
      'https://s3.example.com/put-url'
    );
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith(
      'Content-Type',
      'video/mp4'
    );
    expect(mockXhr.send).toHaveBeenCalledWith(file);
    expect(progressEvents).toEqual([50, 100]);
  });

  it('uploadEpisodeVideoSource POSTs multipart FormData to the backend proxy endpoint', async () => {
    const file = new File(['fake video content'], 'test.mp4', {
      type: 'video/mp4',
    });
    const mockEpisode = {
      id: 'ep-1',
      title: 'Episode 1',
      videoSources: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const mockXhr = createMockXhr({
      status: 200,
      responseText: JSON.stringify({ data: mockEpisode }),
    });

    xhrSpy = vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function () {
      return mockXhr as unknown as XMLHttpRequest;
    } as unknown as () => XMLHttpRequest);

    const res = await uploadEpisodeVideoSource('ep-1', {
      file,
      label: 'S3 High Quality',
      quality: '1080p',
    });

    expect(mockXhr.open).toHaveBeenCalledWith(
      'POST',
      expect.stringContaining('/api/episodes/ep-1/sources/upload')
    );
    expect(mockXhr.withCredentials).toBe(true);
    expect(mockXhr.setRequestHeader).not.toHaveBeenCalledWith(
      'Content-Type',
      expect.anything()
    );
    const form = (mockXhr.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as unknown as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect((form.get('file') as File).name).toBe('test.mp4');
    expect(form.get('label')).toBe('S3 High Quality');
    expect(form.get('quality')).toBe('1080p');
    expect(res.id).toBe('ep-1');
  });

  it('uploadEpisodeVideoSource emits upload progress percentages', async () => {
    const file = new File(['fake video content'], 'test.mp4', {
      type: 'video/mp4',
    });
    const progressEvents: number[] = [];

    const mockXhr = createMockXhr({
      onSend: (xhr) => {
        xhr.upload.onprogress?.({
          lengthComputable: true,
          loaded: 25,
          total: 100,
        });
        xhr.upload.onprogress?.({
          lengthComputable: true,
          loaded: 100,
          total: 100,
        });
        xhr.status = 200;
        xhr.responseText = JSON.stringify({ data: { id: 'ep-1' } });
        xhr.onload?.();
      },
    });

    xhrSpy = vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function () {
      return mockXhr as unknown as XMLHttpRequest;
    } as unknown as () => XMLHttpRequest);

    await uploadEpisodeVideoSource('ep-1', {
      file,
      label: 'Label',
      onProgress: (p) => {
        progressEvents.push(p.percent);
      },
    });

    expect(progressEvents).toEqual([25, 100]);
  });

  it('uploadEpisodeVideoSource aborts when signal is aborted', async () => {
    const file = new File(['fake video content'], 'test.mp4', {
      type: 'video/mp4',
    });
    const controller = new AbortController();

    const mockXhr = createMockXhr({
      onSend: () => {
        controller.abort();
      },
    });

    xhrSpy = vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function () {
      return mockXhr as unknown as XMLHttpRequest;
    } as unknown as () => XMLHttpRequest);

    await expect(
      uploadEpisodeVideoSource('ep-1', {
        file,
        label: 'Label',
        signal: controller.signal,
      })
    ).rejects.toThrow('Aborted');

    expect(mockXhr.abort).toHaveBeenCalled();
  });

  it('uploadEpisodeVideoSource surfaces S3_NOT_CONFIGURED code on 503', async () => {
    const file = new File(['fake video content'], 'test.mp4', {
      type: 'video/mp4',
    });

    const mockXhr = createMockXhr({
      status: 503,
      responseText: JSON.stringify({
        error: {
          code: 'S3_NOT_CONFIGURED',
          message: 'S3 storage service is not configured',
        },
      }),
    });

    xhrSpy = vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function () {
      return mockXhr as unknown as XMLHttpRequest;
    } as unknown as () => XMLHttpRequest);

    const err = await uploadEpisodeVideoSource('ep-1', {
      file,
      label: 'Label',
    }).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error & { code?: string }).code).toBe('S3_NOT_CONFIGURED');
  });

  it('uploadEpisodeVideoSource surfaces FILE_TOO_LARGE code and message on 413 with JSON body', async () => {
    const file = new File(['fake video content'], 'test.mp4', {
      type: 'video/mp4',
    });

    const mockXhr = createMockXhr({
      status: 413,
      responseText: JSON.stringify({
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'File size exceeds the maximum allowed limit of 1GB',
        },
      }),
    });

    xhrSpy = vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function () {
      return mockXhr as unknown as XMLHttpRequest;
    } as unknown as () => XMLHttpRequest);

    const err = await uploadEpisodeVideoSource('ep-1', {
      file,
      label: 'Label',
    }).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error & { code?: string }).code).toBe('FILE_TOO_LARGE');
    expect((err as Error).message).toBe(
      'File size exceeds the maximum allowed limit of 1GB'
    );
  });

  it('uploadEpisodeVideoSource falls back to FILE_TOO_LARGE on 413 with raw/plain-text response', async () => {
    const file = new File(['fake video content'], 'test.mp4', {
      type: 'video/mp4',
    });

    const mockXhr = createMockXhr({
      status: 413,
      responseText:
        '<html><body><h1>413 Request Entity Too Large</h1></body></html>',
    });

    xhrSpy = vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function () {
      return mockXhr as unknown as XMLHttpRequest;
    } as unknown as () => XMLHttpRequest);

    const err = await uploadEpisodeVideoSource('ep-1', {
      file,
      label: 'Label',
    }).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error & { code?: string }).code).toBe('FILE_TOO_LARGE');
    expect((err as Error).message).toBe(
      'File size exceeds the maximum allowed limit of 1 GB'
    );
  });

  it('uploadBinaryToS3 aborts when signal is aborted', async () => {
    const file = new File(['fake video content'], 'test.mp4', {
      type: 'video/mp4',
    });
    const controller = new AbortController();

    const mockXhr = createMockXhr({
      onSend: () => {
        controller.abort();
      },
    });

    xhrSpy = vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function () {
      return mockXhr as unknown as XMLHttpRequest;
    } as unknown as () => XMLHttpRequest);

    await expect(
      uploadBinaryToS3({
        url: 'https://s3.example.com/put-url',
        file,
        signal: controller.signal,
      })
    ).rejects.toThrow('Aborted');

    expect(mockXhr.abort).toHaveBeenCalled();
  });

  it('getUploadProgress fetches progress data from /api/episodes/upload-progress/:sessionId', async () => {
    const mockProgressData = {
      data: {
        loaded: 52428800,
        total: 104857600,
        percent: 50,
      },
    };

    mockFetch.get('/api/episodes/upload-progress/:sessionId', mockProgressData);

    const res = await getUploadProgress('sess-123');

    const lastReq = mockFetch.lastRequest();
    expect(lastReq?.url.pathname).toContain(
      '/episodes/upload-progress/sess-123'
    );
    expect(res).toEqual({
      loaded: 52428800,
      total: 104857600,
      percent: 50,
    });
  });
});
