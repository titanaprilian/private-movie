import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  Bell,
  List,
  LogOut,
  Moon,
  PanelLeft,
  Server,
  Sun,
  User,
  Video,
  X,
} from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useAuth } from '@/modules/auth';
import { ChunkyTooltip } from '@/components/ui/chunky-tooltip';

export interface ShellProps {
  children: ReactNode;
}

const navItems = [
  {
    to: '/admin/videos' as const,
    label: 'Series',
    activeOptions: { exact: false },
    Icon: Video,
  },
  {
    to: '/admin/genres' as const,
    label: 'Genres',
    activeOptions: { exact: false },
    Icon: List,
  },
  {
    to: '/admin/storage' as const,
    label: 'Storage',
    activeOptions: { exact: false },
    Icon: Server,
  },
];

/** Chunky Duolingo-style 3D button: 2px border, 4px bottom border, presses down 2px. */
const chunkyButtonClass =
  'inline-flex items-center justify-center gap-2 h-11 min-w-11 px-3.5 rounded-[14px] border-2 border-[var(--border)] border-b-4 bg-[var(--bg)] text-[var(--muted)] font-extrabold text-[13px] uppercase tracking-[0.7px] transition-all hover:bg-[var(--surface)] active:border-b-2 active:translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] cursor-pointer';

const navBaseClass =
  'flex items-center gap-3.5 h-[52px] px-4 rounded-[14px] border-2 font-extrabold text-sm uppercase tracking-[0.8px] whitespace-nowrap overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]';
const navActiveClass = `${navBaseClass} bg-[var(--green-soft)] border-[var(--green)] text-[var(--green)]`;
const navInactiveClass = `${navBaseClass} border-transparent text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]`;

/** Picks the readable logo variant: dark ink on light backgrounds, light ink on dark. */
function brandLogoSrc(theme: 'light' | 'dark', variant: 'full' | 'collapsed') {
  if (variant === 'collapsed') {
    return theme === 'light' ? '/assets/logo-collapsed-dark.png' : '/assets/logo-collapsed.png';
  }
  return theme === 'light' ? '/assets/logo-full-dark.png' : '/assets/logo-full.png';
}

function BrandCell({ collapsed }: { collapsed: boolean }) {
  const theme = useUIStore((s) => s.theme);
  return (
    <div className="h-20 flex items-center justify-center px-5 border-b-2 border-[var(--border)] overflow-hidden shrink-0">
      {collapsed ? (
        <img
          src={brandLogoSrc(theme, 'collapsed')}
          alt="Private Movie collapsed logo"
          className="w-14 h-auto"
        />
      ) : (
        <img
          src={brandLogoSrc(theme, 'full')}
          alt="Private Movie"
          className="h-[52px] w-auto"
        />
      )}
    </div>
  );
}

function NavLinks({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Admin navigation" className="flex-1 px-3 py-4 space-y-1.5 overflow-hidden">
      {navItems.map(({ to, label, activeOptions, Icon }) => {
        const link = (
          <Link
            key={to}
            to={to}
            activeOptions={activeOptions}
            onClick={onNavigate}
            aria-label={label}
            activeProps={{ className: `${navActiveClass}${collapsed ? ' justify-center px-0' : ''}` }}
            inactiveProps={{
              className: `${navInactiveClass}${collapsed ? ' justify-center px-0' : ''}`,
            }}
          >
            <Icon className="w-6 h-6 shrink-0" strokeWidth={2} aria-hidden="true" />
            {!collapsed && <span>{label}</span>}
          </Link>
        );
        // Collapsed sidebar shows icon-only links: explain them via chunky
        // tooltip instead of a native browser title.
        if (!collapsed) return link;
        return (
          <ChunkyTooltip key={to} content={label} side="right">
            {link}
          </ChunkyTooltip>
        );
      })}
    </nav>
  );
}

function ProfileCard({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { user } = useAuth();
  const displayName = user?.name ?? user?.email?.split('@')[0] ?? 'User Name';
  const displayEmail = user?.email ?? 'user@email.com';

  if (collapsed) {
    return (
      <div className="mx-3 mb-4 flex justify-center">
        <Link
          to="/admin/profile"
          onClick={onNavigate}
          aria-label={`Profile for ${displayName}`}
          activeOptions={{ exact: false }}
          activeProps={{
            className:
              'w-[38px] h-[38px] rounded-full bg-[var(--blue)] border-b-[3px] border-[var(--blue-dark)] grid place-items-center text-white shrink-0 ring-2 ring-[var(--green)] ring-offset-2 ring-offset-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]',
          }}
          inactiveProps={{
            className:
              'w-[38px] h-[38px] rounded-full bg-[var(--blue)] border-b-[3px] border-[var(--blue-dark)] grid place-items-center text-white shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]',
          }}
        >
          <User className="w-5 h-5" aria-label="User avatar" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-3 mb-4 overflow-hidden">
      <Link
        to="/admin/profile"
        onClick={onNavigate}
        activeOptions={{ exact: false }}
        activeProps={{
          className:
            'flex items-center gap-2.5 p-2.5 rounded-[14px] border-2 border-[var(--green)] border-b-4 bg-[var(--green-soft)] overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]',
        }}
        inactiveProps={{
          className:
            'flex items-center gap-2.5 p-2.5 rounded-[14px] border-2 border-[var(--border)] border-b-4 bg-transparent overflow-hidden transition-colors hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]',
        }}
      >
        <div className="w-[38px] h-[38px] rounded-full bg-[var(--blue)] border-b-[3px] border-[var(--blue-dark)] grid place-items-center text-white shrink-0">
          <User className="w-5 h-5" aria-label="User avatar" />
        </div>
        <div className="leading-tight overflow-hidden min-w-0">
          <div className="text-sm font-extrabold truncate">{displayName}</div>
          <div className="text-xs font-semibold text-[var(--muted)] truncate">
            {displayEmail}
          </div>
        </div>
      </Link>
    </div>
  );
}

export function Shell({ children }: ShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { sidebarCollapsed, toggleSidebar, toggleTheme, theme } = useUIStore();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate({ to: '/login' });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        data-testid="desktop-sidebar"
        className={`hidden md:flex flex-col bg-[var(--bg)] border-r-2 border-[var(--border)] shrink-0 transition-[width] duration-200 ease-in-out ${
          sidebarCollapsed ? 'w-[92px]' : 'w-[224px]'
        }`}
      >
        <BrandCell collapsed={sidebarCollapsed} />
        <NavLinks collapsed={sidebarCollapsed} />
        <ProfileCard collapsed={sidebarCollapsed} />
      </aside>

      {/* Mobile Slide-over Overlay */}
      <div
        onClick={() => setIsMobileOpen(false)}
        data-testid="mobile-overlay"
        aria-hidden="true"
        className={`fixed inset-0 bg-black/40 z-30 md:hidden transition-opacity duration-300 ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Mobile Slide-over Sidebar */}
      <aside
        data-testid="mobile-sidebar"
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        className={`fixed z-40 top-0 left-0 h-full w-[224px] bg-[var(--bg)] border-r-2 border-[var(--border)] transition-transform duration-300 ease-out md:hidden flex flex-col ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-20 flex items-center justify-center px-5 border-b-2 border-[var(--border)] shrink-0 relative">
          <img src={brandLogoSrc(theme, 'full')} alt="Private Movie" className="h-[52px] w-auto" />
          <button
            onClick={() => setIsMobileOpen(false)}
            type="button"
            aria-label="Close menu"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border-2 border-[var(--border)] text-[var(--muted)] grid place-items-center hover:text-[var(--ink)] cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <NavLinks collapsed={false} onNavigate={() => setIsMobileOpen(false)} />
        <ProfileCard collapsed={false} onNavigate={() => setIsMobileOpen(false)} />
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 border-b-2 border-[var(--border)] bg-[var(--bg)] flex items-center gap-3 px-6 sticky top-0 z-20 shrink-0">
          {/* Mobile: open slide-over */}
          <button
            onClick={() => setIsMobileOpen(true)}
            type="button"
            aria-label="Open menu"
            className={`${chunkyButtonClass} md:hidden`}
          >
            <PanelLeft className="w-6 h-6" aria-hidden="true" />
          </button>

          {/* Desktop: collapse/expand sidebar */}
          <button
            onClick={toggleSidebar}
            type="button"
            aria-label="Toggle sidebar"
            aria-expanded={!sidebarCollapsed}
            className={`${chunkyButtonClass} hidden md:inline-flex`}
          >
            <PanelLeft className="w-6 h-6" aria-hidden="true" />
          </button>

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              aria-label="Notifications"
              className={`${chunkyButtonClass} relative`}
            >
              <Bell className="w-6 h-6" aria-hidden="true" />
              <span
                aria-label="3 unread notifications"
                className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-[5px] grid place-items-center bg-[var(--red)] border-2 border-[var(--surface)] rounded-[11px] text-white text-[11px] font-extrabold tracking-normal"
              >
                3
              </span>
            </button>

            <button
              onClick={toggleTheme}
              type="button"
              aria-label="Toggle theme"
              className={chunkyButtonClass}
            >
              {theme === 'dark' ? (
                <Sun className="w-6 h-6" aria-hidden="true" />
              ) : (
                <Moon className="w-6 h-6" aria-hidden="true" />
              )}
            </button>

            <button
              onClick={handleLogout}
              type="button"
              aria-label="Logout"
              className={`${chunkyButtonClass} text-[var(--blue)]`}
            >
              <LogOut className="w-6 h-6" aria-hidden="true" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-5">{children}</main>
      </div>
    </div>
  );
}
