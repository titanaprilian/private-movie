import { describe, expect, it, beforeEach } from 'vitest';
import { createRouter, createMemoryHistory } from '@tanstack/react-router';
import { routeTree } from '@/routeTree.gen';
import { useAuthStore } from '@/modules/auth';

describe('Router integration - /admin auth guard & relocated pages', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      error: null,
    });
  });

  it('redirects /admin to /login when unauthenticated', async () => {
    const memoryHistory = createMemoryHistory({
      initialEntries: ['/admin'],
    });

    const router = createRouter({
      routeTree,
      history: memoryHistory,
    });

    await router.load();

    expect(router.state.location.pathname).toBe('/login');
  });

  it('redirects /admin/videos to /login when unauthenticated', async () => {
    const memoryHistory = createMemoryHistory({
      initialEntries: ['/admin/videos'],
    });

    const router = createRouter({
      routeTree,
      history: memoryHistory,
    });

    await router.load();

    expect(router.state.location.pathname).toBe('/login');
  });

  it('redirects /admin/profile to /login when unauthenticated', async () => {
    const memoryHistory = createMemoryHistory({
      initialEntries: ['/admin/profile'],
    });

    const router = createRouter({
      routeTree,
      history: memoryHistory,
    });

    await router.load();

    expect(router.state.location.pathname).toBe('/login');
  });

  it('allows /admin when authenticated', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin',
        createdAt: new Date(),
      },
    });

    const memoryHistory = createMemoryHistory({
      initialEntries: ['/admin'],
    });

    const router = createRouter({
      routeTree,
      history: memoryHistory,
    });

    await router.load();

    expect(router.state.location.pathname).toBe('/admin');
  });

  it('allows /admin/videos when authenticated', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin',
        createdAt: new Date(),
      },
    });

    const memoryHistory = createMemoryHistory({
      initialEntries: ['/admin/videos'],
    });

    const router = createRouter({
      routeTree,
      history: memoryHistory,
    });

    await router.load();

    expect(router.state.location.pathname).toBe('/admin/videos');
  });

  it('allows /admin/profile when authenticated', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin',
        createdAt: new Date(),
      },
    });

    const memoryHistory = createMemoryHistory({
      initialEntries: ['/admin/profile'],
    });

    const router = createRouter({
      routeTree,
      history: memoryHistory,
    });

    await router.load();

    expect(router.state.location.pathname).toBe('/admin/profile');
  });

  it('allows root / without authentication', async () => {
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
    });

    const memoryHistory = createMemoryHistory({
      initialEntries: ['/'],
    });

    const router = createRouter({
      routeTree,
      history: memoryHistory,
    });

    await router.load();

    expect(router.state.location.pathname).toBe('/');
  });
});
