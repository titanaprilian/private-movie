import { authFetch, getAccessToken, getApiBaseUrl } from '@/lib/api';
import type {
  ArchiveIngestJob,
  ArchiveIngestJobConfirmRequest,
  ArchiveIngestJobCreateRequest,
  ArchiveIngestJobProgress,
  ArchiveIngestJobProgressResponse,
  ArchiveIngestJobResponse,
} from './types';

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

function jobBase(seriesId: string): string {
  return `${getApiBaseUrl()}/api/series/${encodeURIComponent(seriesId)}/archive-ingest/jobs`;
}

async function throwApiError(
  response: Response,
  fallbackMessage: string
): Promise<never> {
  const payload = await response.json().catch(() => null);
  const code = payload?.error?.code;
  const message =
    payload?.error?.message || `${fallbackMessage} (status ${response.status})`;
  const err = Object.assign(new Error(message), {
    code,
    status: response.status,
  });
  throw err;
}

async function parseJobResponse(
  response: Response,
  fallbackMessage: string
): Promise<ArchiveIngestJob> {
  if (!response.ok) {
    await throwApiError(response, fallbackMessage);
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
    await throwApiError(
      response,
      'Failed to fetch archive ingest job progress'
    );
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
