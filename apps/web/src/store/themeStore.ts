import { useUIStore, type Theme } from './uiStore';

export type { Theme };
export interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = useUIStore;
