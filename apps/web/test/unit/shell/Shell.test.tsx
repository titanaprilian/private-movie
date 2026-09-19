import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Shell } from '@/modules/shell';
import { useUIStore } from '@/store/uiStore';

let mockCurrentPath = '/admin';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
    activeProps,
    inactiveProps,
    activeOptions,
    onClick,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
    activeProps?: { className?: string };
    inactiveProps?: { className?: string };
    activeOptions?: { exact?: boolean };
    onClick?: () => void;
  }) => {
    const isExact = activeOptions?.exact ?? false;
    const isActive = isExact
      ? mockCurrentPath === to
      : mockCurrentPath === to || mockCurrentPath.startsWith(to + '/');

    const dynamicClass = isActive
      ? activeProps?.className ?? className
      : inactiveProps?.className ?? className;

    return (
      <a href={to} className={dynamicClass} onClick={onClick}>
        {children}
      </a>
    );
  },
  useNavigate: () => vi.fn(),
}));

describe('Shell layout component', () => {
  beforeEach(() => {
    mockCurrentPath = '/admin';
    useUIStore.setState({ theme: 'light', sidebarCollapsed: false });
  });

  it('renders children content within Shell layout and displays Private Movie branding', () => {
    renderWithProviders(
      <Shell>
        <div data-testid="test-child">Hello Dashboard</div>
      </Shell>
    );

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Hello Dashboard')).toBeInTheDocument();
    expect(screen.getAllByText('Private Movie').length).toBeGreaterThan(0);
    expect(screen.queryByText('monoRepo')).not.toBeInTheDocument();
    expect(screen.queryByText(/workspace/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('Series').length).toBeGreaterThan(0);
  });

  it('renders primary navigation links and omits deprecated template links', () => {
    renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const seriesLinks = screen.getAllByRole('link', { name: /series/i });
    expect(seriesLinks.length).toBeGreaterThan(0);
    expect(seriesLinks[0]).toHaveAttribute('href', '/admin/videos');

    const genresLinks = screen.getAllByRole('link', { name: /genres/i });
    expect(genresLinks.length).toBeGreaterThan(0);
    expect(genresLinks[0]).toHaveAttribute('href', '/admin/genres');

    const storageLinks = screen.getAllByRole('link', { name: /storage/i });
    expect(storageLinks.length).toBeGreaterThan(0);
    expect(storageLinks[0]).toHaveAttribute('href', '/admin/storage');

    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
    expect(screen.queryByText('Customers')).not.toBeInTheDocument();
    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('dynamically applies active link styling based on route matches', () => {
    // 1. Series route
    mockCurrentPath = '/admin/videos';
    const { unmount } = renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const desktopSeriesLink = screen.getAllByRole('link', {
      name: /series/i,
    })[0];
    const desktopGenresLink = screen.getAllByRole('link', {
      name: /genres/i,
    })[0];

    expect(desktopSeriesLink.className).toContain('active-bg');
    expect(desktopSeriesLink.className).toContain('text-primary');
    expect(desktopGenresLink.className).not.toContain('active-bg');
    expect(desktopGenresLink.className).toContain('text-muted');

    unmount();

    // 2. Nested route under series (/admin/videos/series-123)
    mockCurrentPath = '/admin/videos/series-123';
    renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const nestedSeriesLink = screen.getAllByRole('link', {
      name: /series/i,
    })[0];
    const nestedGenresLink = screen.getAllByRole('link', {
      name: /genres/i,
    })[0];

    expect(nestedSeriesLink.className).toContain('active-bg');
    expect(nestedSeriesLink.className).toContain('text-primary');
    expect(nestedGenresLink.className).not.toContain('active-bg');
    expect(nestedGenresLink.className).toContain('text-muted');
  });

  it('toggles sidebar collapse state and updates desktop sidebar width and label visibility', async () => {
    const { user } = renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const toggleBtn = screen.getByRole('button', { name: /toggle sidebar/i });
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    expect(screen.getAllByText('Private Movie').length).toBe(2);

    await user.click(toggleBtn);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    expect(screen.getAllByText('Private Movie').length).toBe(1);

    await user.click(toggleBtn);
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    expect(screen.getAllByText('Private Movie').length).toBe(2);
  });

  it('renders anonymous user profile avatar in the sidebar and omits external pravatar placeholder', () => {
    renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const avatars = screen.getAllByLabelText('User avatar');
    expect(avatars.length).toBeGreaterThan(0);
    expect(screen.queryByRole('img', { name: /user avatar/i })).not.toBeInTheDocument();
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
