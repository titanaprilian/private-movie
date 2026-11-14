import { authFetch, getAccessToken, getApiBaseUrl } from '@/lib/api';
import type {
  ArchiveIngestCommitRequest,
  ArchiveIngestCommitSseEvent,
  ArchiveIngestPreviewRequest,
  ArchiveIngestPreviewResponse,
  ArchiveIngestPreviewSseEvent,
  ArchiveStagedFileItem,
  ArchiveIngestJob,
  ArchiveIngestJobConfirmRequest,
  ArchiveIngestJobCreateRequest,
  ArchiveIngestJobProgress,
  ArchiveIngestJobProgressResponse,
  ArchiveIngestJobResponse,
} from './types';

function parseArchiveSseChunk(
  chunk: string
): ArchiveIngestPreviewSseEvent | ArchiveIngestCommitSseEvent | null {
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

  if (!eventType || !eventDataStr) return null;

  try {
    const data = JSON.parse(eventDataStr) as unknown;
    return { type: eventType, data } as
      ArchiveIngestPreviewSseEvent | ArchiveIngestCommitSseEvent;
  } catch {
    return null;
  }
}

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAccessToken();
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export interface ArchivePreviewCallbacks {
  onDownloadProgress?: (payload: {
    loaded: number;
    total?: number | null;
    percent?: number | null;
  }) => void;
  onExtractProgress?: (payload: {
    currentFile: string;
    totalFiles?: number | null;
  }) => void;
  signal?: AbortSignal;
}

/**
 * POST /api/series/:id/archive-ingest/preview
 */
export async function archiveIngestPreview(
  seriesId: string,
  request: ArchiveIngestPreviewRequest,
  callbacks?: ArchivePreviewCallbacks
): Promise<ArchiveIngestPreviewResponse> {
  const apiUrl = `${getApiBaseUrl()}/api/series/${encodeURIComponent(seriesId)}/archive-ingest/preview`;
  const headers = await buildAuthHeaders();

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
    signal: callbacks?.signal,
  });

  if (!response.ok) {
    let errorCode: string | undefined;
    let errorMessage = `Archive preview failed (status ${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.error) {
        errorCode = errJson.error.code;
        errorMessage = errJson.error.message || errorMessage;
      }
    } catch {
      // ignore
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
    throw new Error('No response body for archive preview stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ArchiveIngestPreviewResponse | null = null;

  const processChunk = (chunk: string) => {
    const event = parseArchiveSseChunk(chunk);
    if (!event) return;

    if (event.type === 'download_progress' && callbacks?.onDownloadProgress) {
      const d = event.data as {
        loaded: number;
        total?: number | null;
        percent?: number | null;
      };
      callbacks.onDownloadProgress(d);
    } else if (
      event.type === 'extract_progress' &&
      callbacks?.onExtractProgress
    ) {
      const d = event.data as {
        currentFile: string;
        totalFiles?: number | null;
      };
      callbacks.onExtractProgress(d);
    } else if (event.type === 'preview_ready') {
      const d = event.data as {
        stagingSessionId: string;
        items: ArchiveStagedFileItem[];
      };
      result = { stagingSessionId: d.stagingSessionId, items: d.items };
    } else if (event.type === 'error') {
      const d = event.data as { code: string; message: string };
      const err = new Error(d.message || 'Archive preview error') as Error & {
        code?: string;
      };
      if (d.code) err.code = d.code;
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
      if (chunk.trim()) processChunk(chunk);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const chunks = buffer.split(/\n\n+/);
    for (const chunk of chunks) {
      if (chunk.trim()) processChunk(chunk);
    }
  }

  if (!result) {
    throw new Error('Archive preview stream ended without preview_ready event');
  }

  return result;
}

export interface ArchiveCommitCallbacks {
  onUploadProgress?: (payload: {
    fileIndex: number;
    totalFiles: number;
    filename: string;
    percent: number;
    loaded: number;
    total?: number | null;
  }) => void;
  onFileCompleted?: (payload: {
    episodeId: string;
    videoSourceId: string;
  }) => void;
  signal?: AbortSignal;
}

export interface ArchiveCommitResult {
  success: true;
  count: number;
}

/**
 * POST /api/series/:id/archive-ingest/commit
 */
export async function archiveIngestCommit(
  seriesId: string,
  request: ArchiveIngestCommitRequest,
  callbacks?: ArchiveCommitCallbacks
): Promise<ArchiveCommitResult> {
  const apiUrl = `${getApiBaseUrl()}/api/series/${encodeURIComponent(seriesId)}/archive-ingest/commit`;
  const headers = await buildAuthHeaders();

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
    signal: callbacks?.signal,
  });

  if (!response.ok) {
    let errorCode: string | undefined;
    let errorMessage = `Archive commit failed (status ${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.error) {
        errorCode = errJson.error.code;
        errorMessage = errJson.error.message || errorMessage;
      }
    } catch {
      // ignore
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
    throw new Error('No response body for archive commit stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ArchiveCommitResult | null = null;

  const processChunk = (chunk: string) => {
    const event = parseArchiveSseChunk(chunk);
    if (!event) return;

    if (event.type === 'upload_progress' && callbacks?.onUploadProgress) {
      const d = event.data as {
        fileIndex: number;
        totalFiles: number;
        filename: string;
        percent: number;
        loaded: number;
        total?: number | null;
      };
      callbacks.onUploadProgress(d);
    } else if (event.type === 'file_completed' && callbacks?.onFileCompleted) {
      const d = event.data as { episodeId: string; videoSourceId: string };
      callbacks.onFileCompleted(d);
    } else if (event.type === 'all_completed') {
      const d = event.data as { success: true; count: number };
      result = d;
    } else if (event.type === 'error') {
      const d = event.data as { code: string; message: string };
      const err = new Error(d.message || 'Archive commit error') as Error & {
        code?: string;
      };
      if (d.code) err.code = d.code;
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
      if (chunk.trim()) processChunk(chunk);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const chunks = buffer.split(/\n\n+/);
    for (const chunk of chunks) {
      if (chunk.trim()) processChunk(chunk);
    }
  }

  if (!result) {
    throw new Error('Archive commit stream ended without all_completed event');
  }

  return result;
}

/**
 * DELETE /api/series/:id/archive-ingest/:sessionId
 */
export async function archiveIngestCleanup(
  seriesId: string,
  stagingSessionId: string
): Promise<void> {
  const apiUrl = `${getApiBaseUrl()}/api/series/${encodeURIComponent(seriesId)}/archive-ingest/${encodeURIComponent(stagingSessionId)}`;
  const headers = await buildAuthHeaders();

  try {
    await fetch(apiUrl, { method: 'DELETE', headers });
  } catch {
    // Cleanup is best-effort
  }
}

function jobBase(seriesId: string): string {
  return `${getApiBaseUrl()}/api/series/${encodeURIComponent(seriesId)}/archive-ingest/jobs`;
}

async function parseJobResponse(
  response: Response,
  fallbackMessage: string
): Promise<ArchiveIngestJob> {
  if (!response.ok) {
    let errorCode: string | undefined;
    let errorMessage = `${fallbackMessage} (status ${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.error) {
        errorCode = errJson.error.code;
        errorMessage = errJson.error.message || errorMessage;
      }
    } catch {
      // ignore
    }
    const err = new Error(errorMessage) as Error & {
      code?: string;
      status?: number;
    };
    if (errorCode) err.code = errorCode;
    err.status = response.status;
    throw err;
  }

  const json = (await response.json()) as
    ArchiveIngestJobResponse | { data?: ArchiveIngestJob };
  const job = (json as ArchiveIngestJobResponse)?.data;
  if (!job || !job.id) {
    throw new Error(fallbackMessage);
  }
  return job;
}

export async function createArchiveIngestJob(
  seriesId: string,
  request: ArchiveIngestJobCreateRequest
): Promise<ArchiveIngestJob> {
  const headers = await buildAuthHeaders();
  const response = await authFetch(jobBase(seriesId), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sourceUrl: request.sourceUrl,
      ...(request.storageProviderId !== undefined
        ? { storageProviderId: request.storageProviderId }
        : {}),
      ...(request.password !== undefined ? { password: request.password } : {}),
      ...(request.referer !== undefined ? { referer: request.referer } : {}),
    }),
  });
  return parseJobResponse(response, 'Failed to start archive ingest job');
}

export async function getArchiveIngestJob(
  seriesId: string,
  jobId: string
): Promise<ArchiveIngestJob> {
  const headers = await buildAuthHeaders();
  const response = await authFetch(
    `${jobBase(seriesId)}/${encodeURIComponent(jobId)}`,
    { headers }
  );
  return parseJobResponse(response, 'Failed to fetch archive ingest job');
}

export async function getArchiveIngestJobProgress(
  seriesId: string,
  jobId: string
): Promise<ArchiveIngestJobProgress> {
  const headers = await buildAuthHeaders();
  const response = await authFetch(
    `${jobBase(seriesId)}/${encodeURIComponent(jobId)}?summary=true`,
    { headers }
  );
  if (!response.ok) {
    let errorCode: string | undefined;
    let errorMessage = `Failed to fetch archive ingest job progress (status ${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.error) {
        errorCode = errJson.error.code;
        errorMessage = errJson.error.message || errorMessage;
      }
    } catch {
      // ignore
    }
    const err = new Error(errorMessage) as Error & {
      code?: string;
      status?: number;
    };
    if (errorCode) err.code = errorCode;
    err.status = response.status;
    throw err;
  }
  const json = (await response.json()) as
    ArchiveIngestJobProgressResponse | { data?: ArchiveIngestJobProgress };
  const progress = (json as ArchiveIngestJobProgressResponse)?.data;
  if (!progress || !progress.id) {
    throw new Error('Failed to fetch archive ingest job progress');
  }
  return progress;
}

export async function confirmArchiveIngestJob(
  seriesId: string,
  jobId: string,
  request: ArchiveIngestJobConfirmRequest
): Promise<ArchiveIngestJob> {
  const headers = await buildAuthHeaders();
  const response = await authFetch(
    `${jobBase(seriesId)}/${encodeURIComponent(jobId)}/confirm`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    }
  );
  return parseJobResponse(response, 'Failed to confirm archive ingest job');
}

export async function cancelArchiveIngestJob(
  seriesId: string,
  jobId: string
): Promise<ArchiveIngestJob> {
  const headers = await buildAuthHeaders();
  const response = await authFetch(
    `${jobBase(seriesId)}/${encodeURIComponent(jobId)}/cancel`,
    { method: 'POST', headers }
  );
  return parseJobResponse(response, 'Failed to cancel archive ingest job');
}

export async function retryArchiveIngestJob(
  seriesId: string,
  jobId: string,
  password?: string | null
): Promise<ArchiveIngestJob> {
  const headers = await buildAuthHeaders();
  const response = await authFetch(
    `${jobBase(seriesId)}/${encodeURIComponent(jobId)}/retry`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...(password ? { password } : {}) }),
    }
  );
  return parseJobResponse(response, 'Failed to retry archive ingest job');
}
