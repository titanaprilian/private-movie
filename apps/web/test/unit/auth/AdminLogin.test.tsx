import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils';
import { AdminLoginForm } from '@/modules/auth/internal/components/AdminLoginForm';
import { AdminLoginPage } from '@/modules/auth/internal/components/AdminLoginPage';
import { useAuthStore } from '@/modules/auth/internal/store';

const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

describe('AdminLoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('renders admin copy, identity/password fields, and no forgot-password link', () => {
    renderWithProviders(<AdminLoginForm />);

    expect(screen.getByText('Admin console')).toBeInTheDocument();
    expect(screen.getByText('Gatekeeper sign in')).toBeInTheDocument();
    expect(screen.getAllByText(/invite-only/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Admin identity')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /enter console/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /forgot password/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/forgot password/i)
    ).not.toBeInTheDocument();
  });

  it('shows validation errors on empty submit without calling the backend', async () => {
    const loginSpy = vi.fn();
    useAuthStore.setState({ login: loginSpy });

    const { user } = renderWithProviders(<AdminLoginForm />);
    await user.click(screen.getByRole('button', { name: /enter console/i }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(loginSpy).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('submits credentials to useAuthStore and navigates to /admin on success', async () => {
    const loginSpy = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({ isAuthenticated: true });
      return true;
    });
    useAuthStore.setState({ login: loginSpy });

    const { user } = renderWithProviders(<AdminLoginForm />);
    await user.type(
      screen.getByLabelText('Admin identity'),
      'admin@example.com'
    );
    await user.type(screen.getByLabelText('Password'), 'supersecret');
    await user.click(screen.getByRole('button', { name: /enter console/i }));

    expect(loginSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@example.com',
        password: 'supersecret',
      })
    );
    expect(navigateMock).toHaveBeenCalledWith({ to: '/admin' });
  });

  it('displays a shake error message when authentication fails', async () => {
    const loginSpy = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({ error: 'Invalid credentials' });
      return false;
    });
    useAuthStore.setState({ login: loginSpy });

    const { user } = renderWithProviders(<AdminLoginForm />);
    await user.type(
      screen.getByLabelText('Admin identity'),
      'admin@example.com'
    );
    await user.type(screen.getByLabelText('Password'), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /enter console/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid credentials');
    expect(alert).toHaveClass('animate-chunky-shake');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('toggles password visibility', async () => {
    const { user } = renderWithProviders(<AdminLoginForm />);
    const password = screen.getByLabelText('Password') as HTMLInputElement;
    expect(password.type).toBe('password');
    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(password.type).toBe('text');
    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(password.type).toBe('password');
  });
});

describe('AdminLoginPage layout', () => {
  it('renders purple gatekeeper showcase, mobile brand header, and auth card', () => {
    renderWithProviders(<AdminLoginPage />);

    expect(screen.getByTestId('admin-login-page')).toBeInTheDocument();
    expect(screen.getByTestId('admin-login-showcase')).toBeInTheDocument();
    expect(screen.getByTestId('admin-login-mascot')).toBeInTheDocument();
    expect(
      screen.getByTestId('admin-login-mobile-header')
    ).toBeInTheDocument();
    expect(screen.getByTestId('admin-login-card')).toBeInTheDocument();
  });

  it('uses the Private Movie logo artwork instead of plain text branding', () => {
    renderWithProviders(<AdminLoginPage />);

    const logos = screen.getAllByAltText('Private Movie');
    expect(logos.length).toBeGreaterThanOrEqual(2);
    for (const logo of logos) {
      expect(logo).toHaveAttribute(
        'src',
        expect.stringContaining('/assets/logo-full')
      );
    }
    expect(screen.queryByText(/^Private Movie$/)).not.toBeInTheDocument();
  });
});
