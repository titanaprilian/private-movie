import {
  api,
  extractErrorMessage,
  getAccessToken,
  getApiBaseUrl,
} from '@/lib/api';
import type {
  Episode,
  PresignUploadSourceParams,
  PresignUploadSourceResult,
} from './types';

export async function presignUploadSource(
  episodeId: string,
  params: PresignUploadSourceParams
): Promise<PresignUploadSourceResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.episodes as any)[episodeId].sources[
    'presign-upload'
  ].post(params);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    const errorVal = res.error?.value as
      | {
          error?: { code?: string; message?: string };
          code?: string;
          message?: string;
        }
      | undefined;
    const code = errorVal?.error?.code || errorVal?.code;
    const message = extractErrorMessage(
      res.error,
      'Failed to request presigned upload URL'
    );
    const err = new Error(message) as Error & { code?: string };
    if (code) err.code = code;
    throw err;
  }

  return res.data.data as PresignUploadSourceResult;
}

export interface UploadEpisodeVideoSourceOptions {
  file: File;
  label: string;
  quality?: string;
  storageProviderId?: string;
  uploadSessionId?: string;
  onProgress?: (progress: {
    percent: number;
    loaded: number;
    total: number;
  }) => void;
  signal?: AbortSignal;
}

export function getMaxUploadSizeMb(): number {
  const envVal = import.meta.env.VITE_MAX_UPLOAD_SIZE_MB as string | undefined;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 1024;
}

export function getMaxUploadSizeBytes(): number {
  return getMaxUploadSizeMb() * 1024 * 1024;
}

function parseUploadErrorPayload(raw: string): {
  code?: string;
  message?: string;
} {
  try {
    const json = JSON.parse(raw) as {
      error?: { code?: string; message?: string };
      code?: string;
      message?: string;
    };
    return {
      code: json?.error?.code || json?.code,
      message: json?.error?.message || json?.message,
    };
  } catch {
    return {};
  }
}

/**
 * Upload a video file through the backend proxy endpoint
 * `POST /api/episodes/:id/sources/upload` (multipart/form-data).
 */
export function uploadEpisodeVideoSource(
  episodeId: string,
  options: UploadEpisodeVideoSourceOptions
): Promise<Episode> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${getApiBaseUrl()}/api/episodes/${encodeURIComponent(
      episodeId
    )}/sources/upload`;
    xhr.open('POST', url);
    xhr.withCredentials = true;

    const token = getAccessToken();
    if (token) {
      xhr.setRequestHeader('authorization', `Bearer ${token}`);
    }

    const { signal, onProgress } = options;

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener(
        'abort',
        () => {
          xhr.abort();
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true }
      );
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress({ percent, loaded: event.loaded, total: event.total });
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText) as {
            data?: unknown;
          };
          if (json && 'data' in json && json.data) {
            resolve(json.data as Episode);
          } else {
            reject(new Error('Failed to upload video source'));
          }
        } catch {
          reject(new Error('Failed to upload video source'));
        }
        return;
      }

      let { code, message } = parseUploadErrorPayload(xhr.responseText);

      if (xhr.status === 413) {
        if (!code) {
          code = 'FILE_TOO_LARGE';
        }
        if (!message) {
          const maxMb = getMaxUploadSizeMb();
          const maxGb =
            maxMb >= 1024 && maxMb % 1024 === 0
              ? `${maxMb / 1024} GB`
              : `${maxMb} MB`;
          message = `File size exceeds the maximum allowed limit of ${maxGb}`;
        }
      }

      const err = new Error(
        message || `Failed to upload video source (status ${xhr.status})`
      ) as Error & { code?: string; status?: number };
      if (code) err.code = code;
      err.status = xhr.status;
      reject(err);
    };

    xhr.onerror = () => {
      reject(new Error('Network error during video upload'));
    };

    xhr.onabort = () => {
      reject(new DOMException('Aborted', 'AbortError'));
    };

    const form = new FormData();
    form.append('file', options.file, options.file.name);
    form.append('label', options.label);
    if (options.quality) {
      form.append('quality', options.quality);
    }
    if (options.storageProviderId) {
      form.append('storageProviderId', options.storageProviderId);
    }
    if (options.uploadSessionId) {
      form.append('uploadSessionId', options.uploadSessionId);
    }

    xhr.send(form);
  });
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export async function getUploadProgress(
  sessionId: string
): Promise<UploadProgress> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.episodes as any)['upload-progress'][sessionId].get();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Upload session not found'));
  }

  return res.data.data as UploadProgress;
}

export interface UploadBinaryOptions {
  url: string;
  file: File;
  onProgress?: (progress: {
    percent: number;
    loaded: number;
    total: number;
  }) => void;
  signal?: AbortSignal;
}

export function uploadBinaryToS3({
  url,
  file,
  onProgress,
  signal,
}: UploadBinaryOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    if (file.type) {
      xhr.setRequestHeader('Content-Type', file.type);
    }

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress({ percent, loaded: event.loaded, total: event.total });
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3 upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during S3 upload'));
    };

    xhr.onabort = () => {
      reject(new DOMException('Aborted', 'AbortError'));
    };

    xhr.send(file);
  });
}

export interface RemoteIngestEpisodeVideoSourceOptions {
  url: string;
  label: string;
  quality?: string | null;
  referer?: string | null;
  storageProviderId?: string | null;
  onProgress?: (progress: {
    percent: number;
    loaded: number;
    total: number;
  }) => void;
  signal?: AbortSignal;
}

export async function remoteIngestEpisodeVideoSource(
  episodeId: string,
  options: RemoteIngestEpisodeVideoSourceOptions
): Promise<Episode> {
  const apiUrl = `${getApiBaseUrl()}/api/episodes/${encodeURIComponent(
    episodeId
  )}/sources/remote-ingest`;
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      url: options.url,
      label: options.label,
      quality: options.quality || undefined,
      referer: options.referer || undefined,
      storageProviderId: options.storageProviderId || undefined,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    let errorCode: string | undefined;
    let errorMessage = `Failed to ingest remote video (status ${response.status})`;
    try {
      const json = await response.json();
      if (json?.error) {
        errorCode = json.error.code;
        errorMessage = json.error.message || errorMessage;
      }
    } catch {
      // ignore JSON parse error
    }
    const err = new Error(errorMessage) as Error & {
      code?: string;
      status?: number;
    };
    if (errorCode) err.code = errorCode;
    err.status = response.status;
    throw err;
  }

  if (!response.body) {
    throw new Error('No response body received for remote ingest stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completedEpisode: Episode | null = null;

  const parseSSEChunk = (chunk: string) => {
    const lines = chunk.split('\n');
    let eventType = '';
    let eventDataStr = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        eventDataStr = line.slice(6).trim();
      }
    }

    if (!eventType || !eventDataStr) return;

    let data: unknown;
    try {
      data = JSON.parse(eventDataStr);
    } catch {
      return;
    }

    if (eventType === 'progress' && typeof data === 'object' && data !== null) {
      const progressData = data as {
        percent?: number;
        loaded?: number;
        total?: number;
      };
      options.onProgress?.({
        percent: progressData.percent ?? 0,
        loaded: progressData.loaded ?? 0,
        total: progressData.total ?? 0,
      });
    } else if (
      eventType === 'complete' &&
      typeof data === 'object' &&
      data !== null
    ) {
      const completeData = data as { episode?: Episode };
      if (completeData.episode) {
        completedEpisode = completeData.episode;
      }
    } else if (
      eventType === 'error' &&
      typeof data === 'object' &&
      data !== null
    ) {
      const errorData = data as { code?: string; message?: string };
      const err = new Error(
        errorData.message || 'Remote ingest failed'
      ) as Error & { code?: string };
      if (errorData.code) err.code = errorData.code;
      throw err;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\n\n+/);
    buffer = parts.pop() ?? '';

    for (const chunk of parts) {
      parseSSEChunk(chunk);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const chunks = buffer.split(/\n\n+/);
    for (const chunk of chunks) {
      if (chunk.trim()) {
        parseSSEChunk(chunk);
      }
    }
  }

  if (!completedEpisode) {
    throw new Error('Ingest stream ended without completion event');
  }

  return completedEpisode;
}
