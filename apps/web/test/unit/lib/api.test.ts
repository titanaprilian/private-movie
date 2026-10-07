import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { api, authFetch, extractErrorMessage, getAccessToken, setAccessToken } from '@/lib/api';

describe('api client', () => {
  it('includes credentials: include on outgoing requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    await api.health.get();

    expect(fetchSpy).toHaveBeenCalled();
    const [, init] = fetchSpy.mock.calls[0];
    expect(init).toHaveProperty('credentials', 'include');

    fetchSpy.mockRestore();
  });
});

describe('authFetch', () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setAccessToken(null);
  });

  it('attaches the Bearer token and includes credentials', async () => {
    setAccessToken('token-abc');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const res = await authFetch('https://api.example.test/api/series/1');

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0] as [unknown, RequestInit];
    expect(init).toMatchObject({ credentials: 'include' });
    expect(init.headers).toMatchObject({ authorization: 'Bearer token-abc' });
  });

  it('on 401 triggers silent refresh and retries once with the new token', async () => {
    setAccessToken('expired-token');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/auth/refresh')) {
          return new Response(
            JSON.stringify({ data: { tokens: { accessToken: 'fresh-token' } } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        const auth = (init?.headers as Record<string, string> | undefined)?.authorization;
        if (auth === 'Bearer fresh-token') {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response('unauthorized', { status: 401 });
      }) as unknown as typeof fetch
    );

    const res = await authFetch('https://api.example.test/api/series/1');

    expect(res.status).toBe(200);
    // Original request + refresh + exactly one retry (no loop).
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    const refreshCall = fetchSpy.mock.calls.find(([url]) => String(url).includes('/api/auth/refresh'));
    expect(refreshCall).toBeDefined();
    const [, retryInit] = fetchSpy.mock.calls[2] as [unknown, RequestInit];
    expect(retryInit.headers).toMatchObject({ authorization: 'Bearer fresh-token' });
    // Token store updated for subsequent calls.
    expect(getAccessToken()).toBe('fresh-token');
  });

  it('returns the 401 response without retrying when silent refresh fails', async () => {
    setAccessToken('expired-token');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (async () => new Response('unauthorized', { status: 401 })) as unknown as typeof fetch
    );

    const res = await authFetch('https://api.example.test/api/series/1');

    expect(res.status).toBe(401);
    // Original request + one refresh attempt only — no infinite retry loop.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(getAccessToken()).toBeNull();
  });

  it('replaces a stale uppercase Authorization header on retry without comma concatenation', async () => {
    setAccessToken('expired-token');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/auth/refresh')) {
          return new Response(
            JSON.stringify({ data: { tokens: { accessToken: 'fresh-token' } } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        const headers = init?.headers as Record<string, string> | undefined;
        const auth = headers?.['authorization'];
        if (auth === 'Bearer fresh-token') {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response('unauthorized', { status: 401 });
      }) as unknown as typeof fetch
    );

    const res = await authFetch('https://api.example.test/api/series/1', {
      headers: { Authorization: 'Bearer old-token' },
    });

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    const [, retryInit] = fetchSpy.mock.calls[2] as [unknown, RequestInit];
    const retryHeaders = retryInit.headers as Record<string, string>;
    expect(retryHeaders['authorization']).toBe('Bearer fresh-token');
    expect(retryHeaders['Authorization']).toBeUndefined();
    expect(Object.keys(retryHeaders).filter((k) => k.toLowerCase() === 'authorization')).toHaveLength(1);
    expect(String(retryHeaders['authorization'])).not.toContain(',');
  });
});

describe('extractErrorMessage', () => {
  it('returns fallback when error is null or undefined', () => {
    expect(extractErrorMessage(null, 'Default error')).toBe('Default error');
    expect(extractErrorMessage(undefined, 'Default error')).toBe('Default error');
  });

  it('returns error string when error itself is a valid string', () => {
    expect(extractErrorMessage('Something went wrong', 'Default error')).toBe('Something went wrong');
  });

  it('ignores [object Object] string and returns fallback', () => {
    expect(extractErrorMessage('[object Object]', 'Default error')).toBe('Default error');
  });

  it('extracts message from standard Elysia / Eden treaty error response { value: { error: { message } } }', () => {
    const error = {
      value: {
        error: {
          code: 'GENRE_ALREADY_EXISTS',
          message: 'Genre with name already exists',
        },
      },
    };
    expect(extractErrorMessage(error, 'Fallback error')).toBe('Genre with name already exists');
  });

  it('extracts message from { value: { message } }', () => {
    const error = {
      value: {
        message: 'Invalid input parameters',
      },
    };
    expect(extractErrorMessage(error, 'Fallback error')).toBe('Invalid input parameters');
  });

  it('extracts message when value is a string or value.error is a string', () => {
    expect(extractErrorMessage({ value: 'Direct value string error' }, 'Fallback error')).toBe('Direct value string error');
    expect(extractErrorMessage({ value: { error: 'Value error string' } }, 'Fallback error')).toBe('Value error string');
  });

  it('extracts message from { error: { message } } or { error: string }', () => {
    const errObjMessage = {
      error: {
        code: 'NOT_FOUND',
        message: 'Entity not found',
      },
    };
    expect(extractErrorMessage(errObjMessage, 'Fallback error')).toBe('Entity not found');

    const errString = {
      error: 'Direct error string',
    };
    expect(extractErrorMessage(errString, 'Fallback error')).toBe('Direct error string');
  });

  it('extracts message from standard Error object { message }', () => {
    const standardError = new Error('Network timeout');
    expect(extractErrorMessage(standardError, 'Fallback error')).toBe('Network timeout');
  });

  it('returns fallback when error object contains no recognizable message string', () => {
    expect(extractErrorMessage({}, 'Fallback error')).toBe('Fallback error');
    expect(extractErrorMessage({ foo: 'bar' }, 'Fallback error')).toBe('Fallback error');
    expect(extractErrorMessage({ value: {} }, 'Fallback error')).toBe('Fallback error');
  });
});
