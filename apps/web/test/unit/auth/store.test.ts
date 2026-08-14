import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '../../utils';
import { setAccessToken, getAccessToken } from '@/lib/api';
import { useAuthStore, useAuth } from '@/modules/auth';
import type { User } from '@repo/contracts';

const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date(),
};

describe('useAuthStore - logoutAll', () => {
  beforeEach(() => {
    localStorage.clear();
    setAccessToken('valid-access-token');
    useAuthStore.setState({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls /auth/logout-all endpoint, clears accessToken, and resets auth state to false/null', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const method = init?.method?.toUpperCase() || 'GET';

        if (url.includes('/auth/logout-all') && method === 'POST') {
          return new Response(JSON.stringify({ data: { success: true } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

    await useAuthStore.getState().logoutAll();

    const logoutAllCalls = fetchSpy.mock.calls.filter(([input, init]) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method?.toUpperCase() || 'GET';
      return url.includes('/auth/logout-all') && method === 'POST';
    });

    expect(logoutAllCalls.length).toBe(1);
    expect(getAccessToken()).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('gracefully clears session even if /auth/logout-all network request fails', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const method = init?.method?.toUpperCase() || 'GET';

        if (url.includes('/auth/logout-all') && method === 'POST') {
          return new Response(
            JSON.stringify({ error: { message: 'Internal Server Error' } }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

    await useAuthStore.getState().logoutAll();

    const logoutAllCalls = fetchSpy.mock.calls.filter(([input, init]) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method?.toUpperCase() || 'GET';
      return url.includes('/auth/logout-all') && method === 'POST';
    });

    expect(logoutAllCalls.length).toBe(1);
    expect(getAccessToken()).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('gracefully clears session even if /auth/logout-all network request throws an exception', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch')
    );

    await useAuthStore.getState().logoutAll();

    expect(getAccessToken()).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('exposes logoutAll through useAuth hook', () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.logoutAll).toBe('function');
  });
});
