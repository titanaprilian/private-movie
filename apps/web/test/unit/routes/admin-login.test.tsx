import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminLoginPageRoute, Route } from '@/routes/admin.login';
import { useAuthStore } from '@/modules/auth/internal/store';
import { redirect } from '@tanstack/react-router';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    createFileRoute: () => (config: unknown) => config,
    redirect: vi.fn((opts) => opts),
    useNavigate: () => vi.fn(),
  };
});

describe('AdminLoginPageRoute (/admin/login)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      error: null,
    });
  });

  const getRouteFn = (name: string) => {
    const routeObj = Route as unknown as Record<string, unknown>;
    const options = routeObj.options as Record<string, unknown> | undefined;
    return (options?.[name] ?? routeObj[name]) as (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...args: any[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) => any;
  };

  it('renders the purple gatekeeper split layout with the admin form', () => {
    renderWithProviders(<AdminLoginPageRoute />);

    expect(screen.getByTestId('admin-login-page')).toBeInTheDocument();
    expect(screen.getByTestId('admin-login-showcase')).toBeInTheDocument();
    expect(screen.getByTestId('admin-login-card')).toBeInTheDocument();
    expect(screen.getByText('Admin console')).toBeInTheDocument();
    expect(screen.getByLabelText('Admin identity')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('redirects an authenticated admin to /admin', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin',
        createdAt: new Date(),
      },
    });

    const beforeLoad = getRouteFn('beforeLoad');
    await expect(beforeLoad({ search: {} })).rejects.toEqual({
      to: '/admin',
    });
    expect(redirect).toHaveBeenCalledWith({ to: '/admin' });
  });

  it('redirects an authenticated admin to the redirect search parameter', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin',
        createdAt: new Date(),
      },
    });

    const beforeLoad = getRouteFn('beforeLoad');
    await expect(
      beforeLoad({ search: { redirect: '/admin/library' } })
    ).rejects.toEqual({ to: '/admin/library' });
    expect(redirect).toHaveBeenCalledWith({ to: '/admin/library' });
  });

  it('renders normally without redirection when unauthenticated', async () => {
    const checkAuthMock = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({ isAuthenticated: false, user: null });
    });
    useAuthStore.setState({ checkAuth: checkAuthMock });

    const beforeLoad = getRouteFn('beforeLoad');
    await expect(beforeLoad({ search: {} })).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();

    renderWithProviders(<AdminLoginPageRoute />);
    expect(screen.getByTestId('admin-login-page')).toBeInTheDocument();
  });

  it('validates the optional redirect search parameter', () => {
    const validateSearch = getRouteFn('validateSearch') as (
      search: Record<string, unknown>
    ) => { redirect?: string };
    expect(validateSearch({ redirect: '/admin' })).toEqual({
      redirect: '/admin',
    });
    expect(validateSearch({})).toEqual({ redirect: undefined });
    expect(validateSearch({ redirect: 42 })).toEqual({ redirect: undefined });
  });
});
