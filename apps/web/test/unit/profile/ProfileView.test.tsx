import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProfileView } from '@/modules/profile';
import { useAuthStore } from '@/modules/auth';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

describe('ProfileView component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date('2025-01-01T12:00:00.000Z'),
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  });

  it('renders user basic info (Name, Email, Account Creation Date)', () => {
    renderWithProviders(<ProfileView />);

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Account Details')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText(/January 1, 2025/i)).toBeInTheDocument();
  });

  it('renders fallback when name is not provided', () => {
    useAuthStore.setState({
      user: {
        id: '2',
        email: 'noname@example.com',
        createdAt: new Date('2025-02-01T12:00:00.000Z'),
      },
    });

    renderWithProviders(<ProfileView />);
    expect(screen.getByText('noname@example.com')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('renders standard logout button and calls logout on click', async () => {
    const logoutSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      logout: logoutSpy,
    });

    const { user } = renderWithProviders(<ProfileView />);

    const logoutButton = screen.getByRole('button', { name: /^logout$/i });
    expect(logoutButton).toBeInTheDocument();

    await user.click(logoutButton);
    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });

  it('renders "Logout All Devices" button', () => {
    renderWithProviders(<ProfileView />);

    const logoutAllButton = screen.getByRole('button', {
      name: /logout all devices/i,
    });
    expect(logoutAllButton).toBeInTheDocument();
  });

  it('opens confirmation dialog on clicking "Logout All Devices" and calls logoutAll when confirmed', async () => {
    const logoutAllSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      logoutAll: logoutAllSpy,
    });

    const { user } = renderWithProviders(<ProfileView />);

    const logoutAllButton = screen.getByRole('button', {
      name: /logout all devices/i,
    });
    await user.click(logoutAllButton);

    expect(
      screen.getByRole('heading', { name: /logout all devices/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/are you sure you want to log out of all devices/i)
    ).toBeInTheDocument();

    const continueButton = screen.getByRole('button', { name: /continue/i });
    await user.click(continueButton);

    expect(logoutAllSpy).toHaveBeenCalledTimes(1);
  });
});
