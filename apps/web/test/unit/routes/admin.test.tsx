import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '../../utils';
import { Route, AdminPage } from '@/routes/admin';
import { useAuthStore } from '@/modules/auth';
import { redirect } from '@tanstack/react-router';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    createFileRoute: () => (config: unknown) => config,
    redirect: vi.fn((opts) => opts),
    Outlet: () => null,
  };
});

describe('/admin route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      error: null,
    });
  });

  const getBeforeLoad = () => {
    const routeObj = Route as unknown as Record<string, unknown>;
    const options = routeObj.options as { beforeLoad?: (...args: unknown[]) => Promise<unknown> } | undefined;
    return options?.beforeLoad ?? (routeObj.beforeLoad as (...args: unknown[]) => Promise<unknown>);
  };

  it('exports Route configuration', () => {
    expect(Route).toBeDefined();
    expect(typeof getBeforeLoad()).toBe('function');
  });

  it('redirects to /login if unauthenticated and checkAuth fails', async () => {
    const checkAuthMock = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({ isAuthenticated: false, user: null });
    });
    useAuthStore.setState({ checkAuth: checkAuthMock });

    const beforeLoad = getBeforeLoad();
    await expect(beforeLoad({})).rejects.toEqual({
      to: '/login',
    });

    expect(checkAuthMock).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith({ to: '/login' });
  });

  it('does not redirect if user is authenticated', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test',
        createdAt: new Date(),
      },
    });

    const checkAuthMock = vi.fn();
    useAuthStore.setState({ checkAuth: checkAuthMock });

    const beforeLoad = getBeforeLoad();
    await expect(beforeLoad({})).resolves.toBeUndefined();
    expect(checkAuthMock).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('renders AdminPage layout with Outlet', () => {
    renderWithProviders(<AdminPage />);
  });
});
