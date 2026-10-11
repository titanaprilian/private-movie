import { describe, expect, it, beforeEach } from 'vitest';
import { createRouter, createMemoryHistory } from '@tanstack/react-router';
import { routeTree } from '@/routeTree.gen';
import { useAuthStore } from '@/modules/auth/internal/store';

function authenticate() {
  useAuthStore.setState({
    isAuthenticated: true,
    user: {
      id: '1',
      email: 'admin@example.com',
      name: 'Admin',
      createdAt: new Date(),
    },
  });
}

describe('storage index route registration', () => {
  it('registers an index route module for /admin/storage/', async () => {
    const mod = await import('@/routes/admin/storage.index');
    expect(mod.Route).toBeDefined();
    expect(mod.StoragePage).toBeDefined();
  });
});

describe('storage routing - index/detail as siblings (no outlet-less parent)', () => {
  beforeEach(() => {
    authenticate();
  });

  it('navigating to /admin/storage matches the storage index route', async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/admin/storage'] }),
    });

    await router.load();

    expect(router.state.location.pathname).toBe('/admin/storage');
    const leafRouteId =
      router.state.matches.at(-1)?.routeId ?? '';
    expect(leafRouteId).toBe('/admin/storage/');
  });

  it('navigating to /admin/storage/$seriesId directly matches the detail route, not the overview', async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/admin/storage/series-123'],
      }),
    });

    await router.load();

    expect(router.state.location.pathname).toBe(
      '/admin/storage/series-123',
    );
    const routeIds = router.state.matches.map((m) => m.routeId);
    expect(
      routeIds.some((id) => id.includes('$seriesId')),
    ).toBe(true);
    const leafRouteId =
      router.state.matches.at(-1)?.routeId ?? '';
    expect(leafRouteId).toBe('/admin/storage/$seriesId');
    // The overview index route must not be in the match stack for a detail URL.
    expect(routeIds).not.toContain('/admin/storage/');
  });
});
