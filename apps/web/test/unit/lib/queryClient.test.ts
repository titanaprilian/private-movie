import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import {
  isNetworkConnectivityError,
  notifyBackendUnreachable,
  queryClient,
  reportCacheError,
  resetOutageToastState,
} from '@/lib/queryClient';

const toastWarning = vi.mocked(toast.warning);

describe('isNetworkConnectivityError', () => {
  it('treats fetch TypeErrors as connectivity failures', () => {
    expect(isNetworkConnectivityError(new TypeError('Failed to fetch'))).toBe(
      true
    );
  });

  it('treats gateway statuses as connectivity failures', () => {
    expect(isNetworkConnectivityError({ status: 502 })).toBe(true);
    expect(isNetworkConnectivityError({ status: 503 })).toBe(true);
    expect(isNetworkConnectivityError({ status: 504 })).toBe(true);
    expect(isNetworkConnectivityError({ status: 0 })).toBe(true);
  });

  it('does not treat application-level rejections as connectivity failures', () => {
    expect(isNetworkConnectivityError({ status: 401 })).toBe(false);
    expect(isNetworkConnectivityError({ status: 403 })).toBe(false);
    expect(isNetworkConnectivityError({ status: 404 })).toBe(false);
    expect(isNetworkConnectivityError({ status: 422 })).toBe(false);
    expect(isNetworkConnectivityError({ status: 500 })).toBe(false);
    expect(isNetworkConnectivityError(new Error('Unauthorized'))).toBe(false);
    expect(isNetworkConnectivityError(null)).toBe(false);
    expect(isNetworkConnectivityError(undefined)).toBe(false);
  });
});

describe('backend-unreachable toast', () => {
  beforeEach(() => {
    resetOutageToastState();
    toastWarning.mockClear();
  });

  it('debounces repeated outage alerts into a single toast', () => {
    notifyBackendUnreachable();
    notifyBackendUnreachable();
    notifyBackendUnreachable();

    expect(toastWarning).toHaveBeenCalledTimes(1);
    expect(toastWarning).toHaveBeenCalledWith(
      'Backend unreachable',
      expect.objectContaining({ description: expect.any(String) })
    );
  });

  it('allows a new toast after the debounce state is reset', () => {
    notifyBackendUnreachable();
    resetOutageToastState();
    notifyBackendUnreachable();

    expect(toastWarning).toHaveBeenCalledTimes(2);
  });

  it('reportCacheError toasts for connectivity failures but stays silent for 401s', () => {
    reportCacheError({ status: 401 });
    expect(toastWarning).not.toHaveBeenCalled();

    reportCacheError(new TypeError('Failed to fetch'));
    reportCacheError({ status: 503 });
    expect(toastWarning).toHaveBeenCalledTimes(1);
  });

  it('emits a single toast for multiple failed queries through the shared queryClient', async () => {
    const failingQuery = (key: string) =>
      queryClient.fetchQuery({
        queryKey: ['outage-probe', key],
        queryFn: async () => {
          throw new TypeError('Failed to fetch');
        },
        retry: false,
      });

    await expect(failingQuery('a')).rejects.toThrow();
    await expect(failingQuery('b')).rejects.toThrow();
    await expect(failingQuery('c')).rejects.toThrow();

    expect(toastWarning).toHaveBeenCalledTimes(1);
  });
});
