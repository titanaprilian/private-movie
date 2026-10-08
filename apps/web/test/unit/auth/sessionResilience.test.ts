import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccessToken, setAccessToken } from '@/lib/api';
import { useAuthStore } from '@/modules/auth/internal/store';
import type { User } from '@repo/contracts';

const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date(),
};

function seedAuthenticatedSession() {
  setAccessToken('stored-access-token');
  useAuthStore.setState({
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    error: null,
  });
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('checkAuth — network failures must not evict the session', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    seedAuthenticatedSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retains the stored access token and session when the server is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch')
    );

    await useAuthStore.getState().checkAuth();

    expect(getAccessToken()).toBe('stored-access-token');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('retains the session when the backend responds with a 503 gateway error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      jsonResponse({ error: { message: 'Service Unavailable' } }, 503)
    );

    await useAuthStore.getState().checkAuth();

    expect(getAccessToken()).toBe('stored-access-token');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('clears the stored token and deauthenticates on an explicit HTTP 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      jsonResponse({ error: { message: 'Unauthorized' } }, 401)
    );

    await useAuthStore.getState().checkAuth();

    expect(getAccessToken()).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
