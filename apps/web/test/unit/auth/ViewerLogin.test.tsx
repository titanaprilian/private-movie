import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils';
import { ViewerLoginForm } from '@/modules/auth/internal/components/ViewerLoginForm';
import { ViewerLoginPage } from '@/modules/auth/internal/components/ViewerLoginPage';
import { useAuthStore } from '@/modules/auth/internal/store';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('ViewerLoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('renders chunky email, password, remember checkbox, and sign-in button', () => {
    renderWithProviders(<ViewerLoginForm />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /remember this device/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /forgot password/i })
    ).toBeInTheDocument();
  });

  it('shows validation errors on empty submit without calling the backend', async () => {
    const loginSpy = vi.fn();
    useAuthStore.setState({ login: loginSpy });
    const { user } = renderWithProviders(<ViewerLoginForm />);
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(loginSpy).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('toggles password visibility', async () => {
    const { user } = renderWithProviders(<ViewerLoginForm />);
    const password = screen.getByLabelText('Password') as HTMLInputElement;
    expect(password.type).toBe('password');
    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(password.type).toBe('text');
    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(password.type).toBe('password');
  });

  it('opens the forgot-password chunky dialog with admin contact info', async () => {
    const { user } = renderWithProviders(<ViewerLoginForm />);
    await user.click(
      screen.getByRole('button', { name: /forgot password/i })
    );
    expect(
      await screen.findByRole('dialog', { name: /forgot your password/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/contact your administrator/i)).toBeInTheDocument();
  });

  it('opens the ask-for-invite dialog with admin contact info instead of navigating', async () => {
    const { user } = renderWithProviders(<ViewerLoginForm />);
    const inviteLink = screen.getByRole('button', { name: /ask for an invite/i });
    expect(inviteLink.tagName).not.toBe('A');
    expect(inviteLink).not.toHaveAttribute('href');
    await user.click(inviteLink);
    expect(
      await screen.findByRole('dialog', { name: /need an account/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/accounts are created by your admin/i)).toBeInTheDocument();
  });

  it('submits valid form with a mock toast and no backend call', async () => {
    const loginSpy = vi.fn();
    useAuthStore.setState({ login: loginSpy });
    const onSuccess = vi.fn();
    const { user } = renderWithProviders(<ViewerLoginForm onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText('Email'), 'viewer@example.com');
    await user.type(screen.getByLabelText('Password'), 'secretpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(toast.success).toHaveBeenCalled();
    expect(loginSpy).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'viewer@example.com' })
    );
  });
});

describe('ViewerLoginPage layout', () => {
  it('renders showcase panel, mobile brand header, and auth card', () => {
    renderWithProviders(<ViewerLoginPage />);
    expect(screen.getByTestId('viewer-login-page')).toBeInTheDocument();
    expect(screen.getByTestId('login-showcase')).toBeInTheDocument();
    expect(screen.getByTestId('login-mascot')).toBeInTheDocument();
    expect(screen.getByTestId('login-mobile-header')).toBeInTheDocument();
    expect(screen.getByTestId('viewer-login-card')).toBeInTheDocument();
  });

  it('uses the Private Movie logo artwork instead of plain text branding', () => {
    renderWithProviders(<ViewerLoginPage />);
    const logos = screen.getAllByAltText('Private Movie');
    expect(logos.length).toBeGreaterThanOrEqual(2);
    for (const logo of logos) {
      expect(logo).toHaveAttribute('src', expect.stringContaining('/assets/logo-full'));
    }
    expect(screen.queryByText(/^Private Movie$/)).not.toBeInTheDocument();
  });
});
