import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Shell } from '@/modules/shell';
import { useUIStore } from '@/store/uiStore';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
    onClick?: () => void;
  }) => (
    <a href={to} className={className} onClick={onClick}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

describe('Shell layout component', () => {
  beforeEach(() => {
    useUIStore.setState({ theme: 'light', sidebarCollapsed: false });
  });

  it('renders children content within Shell layout', () => {
    renderWithProviders(
      <Shell>
        <div data-testid="test-child">Hello Dashboard</div>
      </Shell>
    );

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Hello Dashboard')).toBeInTheDocument();
    expect(screen.getAllByText('monoRepo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
  });

  it('renders primary navigation links and omits deprecated template links', () => {
    renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const videosLinks = screen.getAllByRole('link', { name: /videos/i });
    expect(videosLinks.length).toBeGreaterThan(0);
    expect(videosLinks[0]).toHaveAttribute('href', '/videos');

    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
    expect(screen.queryByText('Customers')).not.toBeInTheDocument();
    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('toggles sidebar collapse state and updates desktop sidebar width and label visibility', async () => {
    const { user } = renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const toggleBtn = screen.getByRole('button', { name: /toggle sidebar/i });
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    expect(screen.getByText('default')).toBeInTheDocument();

    await user.click(toggleBtn);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    expect(screen.queryByText('default')).not.toBeInTheDocument();

    await user.click(toggleBtn);
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    expect(screen.getByText('default')).toBeInTheDocument();
  });

  it('renders user profile stub in the sidebar', () => {
    renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const avatars = screen.getAllByAltText('User avatar');
    expect(avatars.length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/user@email.com|User Name/).length
    ).toBeGreaterThan(0);
  });

  it('toggles theme when theme button in header is clicked', async () => {
    const { user } = renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const themeButton = screen.getByRole('button', { name: /theme/i });
    expect(useUIStore.getState().theme).toBe('light');

    await user.click(themeButton);
    expect(useUIStore.getState().theme).toBe('dark');

    await user.click(themeButton);
    expect(useUIStore.getState().theme).toBe('light');
  });

  it('toggles mobile slideover when hamburger button is clicked and closes on overlay click', async () => {
    const { user } = renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const openMenuBtn = screen.getByRole('button', { name: /open menu/i });
    await user.click(openMenuBtn);

    const closeMenuBtn = screen.getByRole('button', { name: /close menu/i });
    expect(closeMenuBtn).toBeInTheDocument();

    const overlay = screen.getByTestId('mobile-overlay');
    expect(overlay).toBeInTheDocument();

    await user.click(overlay);
    expect(screen.queryByTestId('mobile-overlay')).not.toBeInTheDocument();
  });
});
