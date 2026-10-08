import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/** HTTP statuses that mean "the backend is unreachable", not "the request was rejected". */
const GATEWAY_STATUS_CODES = new Set([502, 503, 504]);

/** How long to suppress duplicate backend-unreachable toasts after one is shown. */
export const OUTAGE_TOAST_DEBOUNCE_MS = 30_000;

function readStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = error as any;
  for (const key of ['status', 'statusCode', 'code']) {
    const value = err[key] ?? err.value?.[key] ?? err.error?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function readMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object') return '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = error as any;
  const candidates = [
    err.message,
    err.value?.message,
    err.error?.message,
    err.value?.error?.message,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate) return candidate;
  }
  return '';
}

/**
 * Returns true when the error represents a lost connection to the backend
 * (offline, connection refused, gateway 502/503/504, …) rather than an
 * application-level rejection such as HTTP 401/403/404/422.
 */
export function isNetworkConnectivityError(error: unknown): boolean {
  if (!error) return false;
  const status = readStatus(error);
  if (status !== null) {
    return GATEWAY_STATUS_CODES.has(status) || status === 0;
  }
  if (error instanceof TypeError) return true;
  return /failed to fetch|network\s?error|network request failed|load failed|connection (refused|reset|lost|closed)|offline|econnrefused|enotfound|etimedout|timeout/i.test(
    readMessage(error)
  );
}

let outageToastTimer: ReturnType<typeof setTimeout> | null = null;

/** Test-only reset for the debounce window. */
export function resetOutageToastState(): void {
  if (outageToastTimer) {
    clearTimeout(outageToastTimer);
    outageToastTimer = null;
  }
}

/**
 * Surface a single debounced warning when the backend is unreachable.
 * Repeated failures inside the debounce window are swallowed so the UI
 * is not spammed with one toast per failed query.
 */
export function notifyBackendUnreachable(): void {
  if (outageToastTimer) return;
  outageToastTimer = setTimeout(() => {
    outageToastTimer = null;
  }, OUTAGE_TOAST_DEBOUNCE_MS);
  toast.warning('Backend unreachable', {
    description: 'Could not reach the server. Retrying in the background…',
  });
}

/** Global cache error hook: only connectivity failures produce a toast. */
export function reportCacheError(error: unknown): void {
  if (isNetworkConnectivityError(error)) {
    notifyBackendUnreachable();
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: reportCacheError,
  }),
  mutationCache: new MutationCache({
    onError: reportCacheError,
  }),
});
