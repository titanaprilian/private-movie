import { api, extractErrorMessage } from '@/lib/api';
import type {
  AddVideoSourceInput,
  Episode,
  UpdateVideoSourceInput,
} from './types';
import { getAccessToken, getApiBaseUrl } from '@/lib/api';

export async function addVideoSource(
  episodeId: string,
  source: AddVideoSourceInput | AddVideoSourceInput[]
): Promise<Episode> {
  const videoSources = Array.isArray(source) ? source : [source];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.episodes as any)[episodeId].sources.post({
    videoSources,
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to add video source')
    );
  }

  return res.data.data as Episode;
}

export async function updateVideoSource(
  episodeId: string,
  sourceId: string,
  updates: UpdateVideoSourceInput
): Promise<Episode> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.episodes as any)[episodeId].sources[sourceId].patch(
    updates
  );

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to update video source')
    );
  }

  return res.data.data as Episode;
}

export async function deleteVideoSource(
  episodeId: string,
  sourceId: string
): Promise<Episode> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.episodes as any)[episodeId].sources[sourceId].delete();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to delete video source')
    );
  }

  return res.data.data as Episode;
}

export interface CheckVideoSourceInput {
  url: string;
  type: 'direct' | 'embed' | 's3';
  referer?: string | null;
}

export interface CheckVideoSourceResult {
  status: 'working' | 'broken';
  statusCode?: number | null;
  latencyMs?: number | null;
  error?: string | null;
}

export async function checkVideoSource(
  input: CheckVideoSourceInput
): Promise<CheckVideoSourceResult> {
  const apiUrl = `${getApiBaseUrl()}/api/media/sources/check`;
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
      url: input.url,
      type: input.type,
      referer: input.referer || undefined,
    }),
  });

  if (!response.ok) {
    let message = `Health check failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        message = errJson.error.message;
      }
    } catch {
      // ignore
    }
    return {
      status: 'broken',
      statusCode: response.status,
      error: message,
    };
  }

  const json = await response.json();
  const data = json?.data;
  return {
    status: data?.status ?? 'broken',
    statusCode: data?.statusCode ?? response.status,
    latencyMs: data?.latencyMs,
    error: data?.error ?? null,
  };
}
