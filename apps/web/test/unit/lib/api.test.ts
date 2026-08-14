import { describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';

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
