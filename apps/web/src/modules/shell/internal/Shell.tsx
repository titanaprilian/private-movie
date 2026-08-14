import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useUIStore } from '@/store/uiStore';
import { useAuth, LogoutButton } from '@/modules/auth';

export interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { sidebarCollapsed, toggleSidebar, toggleTheme } = useUIStore();
  const { user } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-sidebar border-r border-c shrink-0 transition-all duration-200 ease-in-out ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Sidebar Header / Logo */}
        <div className="h-14 flex items-center gap-2 px-4 border-b border-c">
          <div className="w-6 h-6 rounded border border-c bg-primary flex items-center justify-center shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 4h16v6H4zM4 14h10v6H4z"
                fill="currentColor"
                className="text-primary-fg"
              />
            </svg>
          </div>
          {!sidebarCollapsed && (
            <span className="font-semibold text-sm mono whitespace-nowrap">
              monoRepo
            </span>
          )}
          <button
            onClick={toggleSidebar}
            type="button"
            aria-label="Toggle sidebar"
            className="ml-auto text-muted hover:text-current transition-colors cursor-pointer"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform duration-200 ${
                sidebarCollapsed ? 'rotate-180' : ''
              }`}
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        {/* Workspace Breadcrumb */}
        {!sidebarCollapsed && (
          <div className="px-4 py-2 text-xs mono text-muted border-b border-c">
            workspace / <span className="text-current">default</span>
          </div>
        )}

        {/* Navigation links */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          <Link
            to="/"
            className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 active-bg font-medium text-sm rounded-sm"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
            {!sidebarCollapsed && <span>Dashboard</span>}
          </Link>
          <a
            href="#"
            className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 hover-bg text-sm rounded-sm text-muted hover:text-current"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0"
            >
              <path d="M18 20V10M12 20V4M6 20v-6" />
            </svg>
            {!sidebarCollapsed && <span>Analytics</span>}
          </a>
          <a
            href="#"
            className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 hover-bg text-sm rounded-sm text-muted hover:text-current"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0"
            >
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
            {!sidebarCollapsed && <span>Customers</span>}
          </a>
          <a
            href="#"
            className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 hover-bg text-sm rounded-sm text-muted hover:text-current"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0"
            >
              <path d="M20.59 13.41L11 3.83V3H3v8h.83l9.58 9.59a2 2 0 002.83 0l4.35-4.35a2 2 0 000-2.83z" />
              <circle cx="6.5" cy="6.5" r="1" />
            </svg>
            {!sidebarCollapsed && <span>Orders</span>}
          </a>
          <a
            href="#"
            className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 hover-bg text-sm rounded-sm text-muted hover:text-current"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 005 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09A1.65 1.65 0 0015 4.6a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            {!sidebarCollapsed && <span>Settings</span>}
          </a>
        </nav>

        {/* User Profile at bottom */}
        <div className="p-3 border-t border-c">
          <Link
            to="/profile"
            className="flex items-center gap-3 px-2 py-2 rounded-sm hover-bg transition-colors"
          >
            <img
              src="https://i.pravatar.cc/32?img=12"
              alt="User avatar"
              className="w-8 h-8 rounded-full shrink-0"
            />
            {!sidebarCollapsed && (
              <div className="leading-tight overflow-hidden">
                <div className="text-sm font-medium truncate">
                  {user?.name ?? user?.email?.split('@')[0] ?? 'User Name'}
                </div>
                <div className="text-xs text-muted truncate">
                  {user?.email ?? 'user@email.com'}
                </div>
              </div>
            )}
          </Link>
        </div>
      </aside>

      {/* Mobile Slide-over Overlay */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          data-testid="mobile-overlay"
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
        />
      )}

      {/* Mobile Slide-over Sidebar */}
      <aside
        data-testid="mobile-sidebar"
        className={`fixed z-40 top-0 left-0 h-full w-64 bg-sidebar border-r border-c transition-transform duration-300 md:hidden flex flex-col ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 flex items-center gap-2 px-4 border-b border-c">
          <span className="font-semibold text-sm mono">monoRepo</span>
          <button
            onClick={() => setIsMobileOpen(false)}
            type="button"
            aria-label="Close menu"
            className="ml-auto text-muted hover:text-current cursor-pointer"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 text-sm">
          <Link
            to="/"
            onClick={() => setIsMobileOpen(false)}
            className="block pl-3 pr-2 py-1.5 active-bg font-medium rounded-sm"
          >
            Dashboard
          </Link>
          <a
            href="#"
            onClick={() => setIsMobileOpen(false)}
            className="block pl-3 pr-2 py-1.5 hover-bg rounded-sm text-muted hover:text-current"
          >
            Analytics
          </a>
          <a
            href="#"
            onClick={() => setIsMobileOpen(false)}
            className="block pl-3 pr-2 py-1.5 hover-bg rounded-sm text-muted hover:text-current"
          >
            Customers
          </a>
          <a
            href="#"
            onClick={() => setIsMobileOpen(false)}
            className="block pl-3 pr-2 py-1.5 hover-bg rounded-sm text-muted hover:text-current"
          >
            Orders
          </a>
          <a
            href="#"
            onClick={() => setIsMobileOpen(false)}
            className="block pl-3 pr-2 py-1.5 hover-bg rounded-sm text-muted hover:text-current"
          >
            Settings
          </a>
        </nav>
        <div className="p-3 border-t border-c">
          <Link
            to="/profile"
            onClick={() => setIsMobileOpen(false)}
            className="flex items-center gap-3 px-2 py-2 rounded-sm hover-bg transition-colors"
          >
            <img
              src="https://i.pravatar.cc/32?img=12"
              alt="User avatar"
              className="w-8 h-8 rounded-full shrink-0"
            />
            <div className="leading-tight overflow-hidden">
              <div className="text-sm font-medium truncate">
                {user?.name ?? user?.email?.split('@')[0] ?? 'User Name'}
              </div>
              <div className="text-xs text-muted truncate">
                {user?.email ?? 'user@email.com'}
              </div>
            </div>
          </Link>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-c bg-card flex items-center gap-3 px-4 sticky top-0 z-20">
          <button
            onClick={() => setIsMobileOpen(true)}
            type="button"
            aria-label="Open menu"
            className="md:hidden text-muted hover:text-current cursor-pointer"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>

          <div className="text-xs mono text-muted hidden sm:block">
            workspace / <span className="text-current">dashboard</span>
          </div>

          <div className="relative ml-2 hidden sm:block max-w-xs w-full">
            <input
              placeholder="Search…"
              className="w-full pl-3 pr-3 py-1.5 rounded border border-c bg-transparent text-xs mono focus:outline-none focus:border-primary"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              aria-label="Notifications"
              className="relative text-muted hover:text-current cursor-pointer"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary" />
            </button>

            <button
              onClick={toggleTheme}
              type="button"
              className="text-xs px-2 py-1 rounded border border-c text-muted mono cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              theme
            </button>

            {user?.email && (
              <span className="text-xs mono text-muted hidden md:inline-block border-l border-c pl-3">
                {user.email}
              </span>
            )}

            <LogoutButton />
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-5">{children}</main>
      </div>
    </div>
  );
}
