import { beforeEach, describe, expect, it } from 'vitest';
import { useUIStore } from '@/store/uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    useUIStore.setState({ theme: 'light', sidebarCollapsed: false });
  });

  it('initializes with default light theme and expanded sidebar', () => {
    expect(useUIStore.getState().theme).toBe('light');
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('updates theme and DOM class list when setTheme is called', () => {
    useUIStore.getState().setTheme('dark');
    expect(useUIStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    useUIStore.getState().setTheme('light');
    expect(useUIStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggles theme between light and dark', () => {
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('updates sidebarCollapsed when setSidebarCollapsed is called', () => {
    useUIStore.getState().setSidebarCollapsed(true);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);

    useUIStore.getState().setSidebarCollapsed(false);
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('toggles sidebarCollapsed state', () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);

    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('persists UI state to localStorage', () => {
    useUIStore.getState().setTheme('dark');
    useUIStore.getState().setSidebarCollapsed(true);
    const stored = localStorage.getItem('ui-storage');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!).state;
    expect(parsed.theme).toBe('dark');
    expect(parsed.sidebarCollapsed).toBe(true);
  });

  it('updates documentElement class on direct setState call', () => {
    useUIStore.setState({ theme: 'dark' });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
