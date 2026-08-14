import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { useAuthStore } from '@/modules/auth';
import type { User } from '@repo/contracts';

const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date(),
};

describe('Silent Refresh Interceptor and Store Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers background refresh during checkAuth when no access token is stored/available', async () => {
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
        const headers = new Headers(init?.headers);

        if (url.includes('/auth/refresh') && method === 'POST') {
          return new Response(
            JSON.stringify({
              data: {
                user: mockUser,
                tokens: { accessToken: 'new-access-token' },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (url.includes('/auth/me')) {
          const authHeader = headers.get('authorization');
          if (!authHeader || !authHeader.includes('Bearer new-access-token')) {
            return new Response(
              JSON.stringify({ error: { message: 'Unauthorized' } }),
              { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
          }
          return new Response(JSON.stringify({ data: mockUser }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

    await useAuthStore.getState().checkAuth();

    const refreshCalls = fetchSpy.mock.calls.filter(([input, init]) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method?.toUpperCase() || 'GET';
      return url.includes('/auth/refresh') && method === 'POST';
    });

    expect(refreshCalls.length).toBeGreaterThan(0);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('deduplicates 3 concurrent API requests encountering 401 into exactly ONE refresh request', async () => {
    let refreshCallCount = 0;
    let tokenAcquired = false;

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
        const headers = new Headers(init?.headers);

        if (url.includes('/auth/refresh') && method === 'POST') {
          refreshCallCount++;
          await new Promise((resolve) => setTimeout(resolve, 50));
          tokenAcquired = true;
          return new Response(
            JSON.stringify({
              data: {
                user: mockUser,
                tokens: { accessToken: 'new-access-token' },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const authHeader = headers.get('authorization');
        if (
          !tokenAcquired ||
          !authHeader ||
          !authHeader.includes('new-access-token')
        ) {
          return new Response(
            JSON.stringify({ error: { message: 'Unauthorized' } }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ data: { status: 'ok' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

    const results = await Promise.all([
      api.health.get(),
      api.auth.me.get(),
      api.health.get(),
    ]);

    const refreshCalls = fetchSpy.mock.calls.filter(([input, init]) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method?.toUpperCase() || 'GET';
      return url.includes('/auth/refresh') && method === 'POST';
    });

    expect(refreshCalls.length).toBe(1);
    expect(refreshCallCount).toBe(1);
    results.forEach((res) => {
      expect(res.error).toBeNull();
    });
  });

  it('resets state correctly when background refresh fails due to invalid/expired refresh cookie', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method?.toUpperCase() || 'GET';

      if (url.includes('/auth/refresh') && method === 'POST') {
        return new Response(
          JSON.stringify({
            error: { message: 'Invalid or expired refresh token' },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: { message: 'Unauthorized' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    });

    await useAuthStore.getState().checkAuth();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('asserts strictly on external store/api behavior without coupling to internal variables', async () => {
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(typeof useAuthStore.getState().checkAuth).toBe('function');
  });
});
