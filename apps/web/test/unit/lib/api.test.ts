import { describe, expect, it, vi } from 'vitest';
import { api, extractErrorMessage } from '@/lib/api';

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
