import { create } from 'zustand';
import { fetchSeriesTmdbPreview, type TmdbPreviewResult } from '../api';

export interface ScrapeWorkerState {
  isOpen: boolean;
  step: 1 | 2;
  tmdbType: 'tv' | 'movie';
  tmdbId: string;
  includeSpecials: boolean;
  tmdbPreviewData: TmdbPreviewResult | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  openDialog: () => void;
  closeDialog: () => void;
  reset: () => void;
  setTmdbType: (tmdbType: 'tv' | 'movie') => void;
  setTmdbId: (tmdbId: string) => void;
  setIncludeSpecials: (includeSpecials: boolean) => void;
  setStep: (step: 1 | 2) => void;
  backToStep1: () => void;
  submitPreview: () => Promise<boolean>;
}

const initialState = {
  isOpen: false,
  step: 1 as const,
  tmdbType: 'tv' as const,
  tmdbId: '',
  includeSpecials: false,
  tmdbPreviewData: null,
  isLoading: false,
  error: null,
};

export const useScrapeWorkerStore = create<ScrapeWorkerState>((set, get) => ({
  ...initialState,

  openDialog: () => set({ isOpen: true }),
  closeDialog: () => set({ isOpen: false }),
  reset: () => set({ ...initialState }),
  setTmdbType: (tmdbType: 'tv' | 'movie') => set({ tmdbType, error: null }),
  setTmdbId: (tmdbId: string) => set({ tmdbId, error: null }),
  setIncludeSpecials: (includeSpecials: boolean) => set({ includeSpecials }),
  setStep: (step: 1 | 2) => set({ step }),
  backToStep1: () => set({ step: 1 }),

  submitPreview: async () => {
    const { tmdbType, tmdbId } = get();

    if (!tmdbId.trim()) {
      set({ error: 'TMDB ID is required.' });
      return false;
    }

    const parsedId = parseInt(tmdbId.trim(), 10);
    if (Number.isNaN(parsedId) || parsedId <= 0 || !/^\d+$/.test(tmdbId.trim())) {
      set({ error: 'TMDB ID must be a valid positive number.' });
      return false;
    }

    set({ isLoading: true, error: null });

    try {
      const data = await fetchSeriesTmdbPreview(tmdbType, parsedId);
      set({
        isLoading: false,
        tmdbPreviewData: data,
        step: 2,
        error: null,
      });
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch TMDB preview';
      set({
        isLoading: false,
        error: message,
        tmdbPreviewData: null,
        step: 1,
      });
      return false;
    }
  },
}));
