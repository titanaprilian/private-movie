import { loginSchema } from '@/modules/auth/internal/schema';
import { LoginForm } from '@/modules/auth/internal/components/LoginForm';
import { useAuthStore } from '@/modules/auth/internal/store';
import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

describe('loginSchema', () => {
  it('validates required fields email and password', () => {
    const result = loginSchema.safeParse({ email: '', password: '' });
    expect(result.success).toBe(false);
  });

  it('validates email format', () => {
    const result = loginSchema.safeParse({
      email: 'invalid-email',
      password: 'secretpassword',
    });
    expect(result.success).toBe(false);
  });

  it('parses optional rememberThisDevice boolean field', () => {
    const withRemember = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'secretpassword',
      rememberThisDevice: true,
    });
    expect(withRemember.success).toBe(true);
    if (withRemember.success) {
      expect(withRemember.data.rememberThisDevice).toBe(true);
    }

    const withoutRemember = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'secretpassword',
    });
    expect(withoutRemember.success).toBe(true);
    if (withoutRemember.success) {
      expect(withoutRemember.data.rememberThisDevice).toBeUndefined();
    }
  });
});

describe('LoginForm component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('renders form elements using custom UI components', () => {
    renderWithProviders(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /remember this device/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign_in/i })
    ).toBeInTheDocument();
  });

  it('displays validation errors when submitting empty form', async () => {
    const { user } = renderWithProviders(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /sign_in/i }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(await screen.findByText('Password is required')).toBeInTheDocument();
  });

  it('submits form with payload including rememberThisDevice state', async () => {
    const loginSpy = vi.fn().mockResolvedValue(true);
    useAuthStore.setState({ login: loginSpy });

    const { user } = renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'dev@company.com');
    await user.type(screen.getByLabelText(/password/i), 'securePassword123');
    await user.click(
      screen.getByRole('checkbox', { name: /remember this device/i })
    );

    await user.click(screen.getByRole('button', { name: /sign_in/i }));

    expect(loginSpy).toHaveBeenCalledWith({
      email: 'dev@company.com',
      password: 'securePassword123',
      rememberThisDevice: true,
    });
  });
});
