import { beforeEach, describe, expect, it } from 'vitest';
import { useThemeStore } from '@/store/themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    useThemeStore.setState({ theme: 'light' });
  });

  it('initializes with default light theme', () => {
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('updates theme and DOM class list when setTheme is called', () => {
    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    useThemeStore.getState().setTheme('light');
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggles theme between light and dark', () => {
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists theme state to localStorage', () => {
    useThemeStore.getState().setTheme('dark');
    const stored = localStorage.getItem('ui-storage');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).state.theme).toBe('dark');
  });

  it('updates documentElement class on direct setState call', () => {
    useThemeStore.setState({ theme: 'dark' });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
