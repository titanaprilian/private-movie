import { edenTreaty } from '@elysiajs/eden';
import type { App } from '@repo/backend';

export function getApiBaseUrl(): string {
  let envApiUrl = import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && envApiUrl === 'http://localhost:3000' && window.location.hostname !== 'localhost') {
    envApiUrl = window.location.origin;
  }
  const rawBase = envApiUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return rawBase.replace(/\/api\/?$/, '').replace(/\/+$/, '');
}

// Create a global eden client
const API_URL = getApiBaseUrl();

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = (): string | null => {
  return accessToken;
};

async function doSilentRefresh(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) {
        accessToken = null;
        return null;
      }

      const json = await res.json();
      const token =
        json?.data?.tokens?.accessToken ??
        json?.tokens?.accessToken ??
        json?.data?.accessToken ??
        null;
      accessToken = token;
      return token;
    } catch {
      accessToken = null;
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

function getUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function applyAuthHeader(
  init?: RequestInit,
  token?: string | null
): RequestInit {
  const newInit: RequestInit = { ...init, credentials: 'include' };
  const headersObj: Record<string, string> = {};

  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([key, value]) => {
        headersObj[key] = value;
      });
    } else {
      Object.assign(headersObj, init.headers);
    }
  }

  if (token) {
    headersObj['authorization'] = `Bearer ${token}`;
  }

  newInit.headers = headersObj;
  return newInit;
}

const customFetcher = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const urlString = getUrlString(input);

  if (urlString.includes('/auth/refresh')) {
    return fetch(input, { ...init, credentials: 'include' });
  }

  let refreshed = false;
  if (!accessToken) {
    await doSilentRefresh();
    refreshed = true;
  }

  let response = await fetch(input, applyAuthHeader(init, accessToken));

  if (response.status === 401 && !refreshed) {
    const newToken = await doSilentRefresh();
    if (newToken) {
      response = await fetch(input, applyAuthHeader(init, newToken));
    }
  }

  return response;
};

const client = edenTreaty<App>(API_URL, {
  fetcher: customFetcher as typeof fetch,
});

export const api = client.api;

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = error as any;
  if (typeof err === 'string' && err !== '[object Object]') return err;

  if (err.value) {
    if (typeof err.value === 'string' && err.value !== '[object Object]') return err.value;
    if (typeof err.value.error?.message === 'string') return err.value.error.message;
    if (typeof err.value.message === 'string') return err.value.message;
    if (typeof err.value.error === 'string') return err.value.error;
  }
  if (typeof err.error?.message === 'string') return err.error.message;
  if (typeof err.error === 'string') return err.error;
  if (typeof err.message === 'string' && err.message !== '[object Object]') return err.message;
  return fallback;
}
