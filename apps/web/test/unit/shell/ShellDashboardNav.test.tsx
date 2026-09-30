import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Shell } from '@/modules/shell';
import { useUIStore } from '@/store/uiStore';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    activeProps,
    inactiveProps,
    onClick,
    title,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    activeProps?: { className?: string };
    inactiveProps?: { className?: string };
    onClick?: () => void;
    title?: string;
  }) => (
    <a
      href={to}
      className={inactiveProps?.className}
      onClick={onClick}
      title={title}
      {...rest}
    >
      {children}
      {activeProps ? null : null}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

describe('Shell dashboard navigation', () => {
  beforeEach(() => {
    useUIStore.setState({ theme: 'light', sidebarCollapsed: false });
  });

  it('renders Dashboard as the first nav link pointing to /admin', () => {
    renderWithProviders(
      <Shell>
        <div>Content</div>
      </Shell>
    );

    const navs = screen.getAllByRole('navigation', { name: 'Admin navigation' });
    const nav = navs[0];
    const links = nav.querySelectorAll('a[href]');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].getAttribute('href')).toBe('/admin');
    expect(links[0].textContent).toMatch(/dashboard/i);

    const dashboardLinks = screen.getAllByRole('link', { name: /dashboard/i });
    expect(dashboardLinks.length).toBeGreaterThan(0);
    expect(dashboardLinks[0]).toHaveAttribute('href', '/admin');
  });
});
