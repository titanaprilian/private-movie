import { create } from 'zustand';
import { fetchSeriesTmdbPreview } from '../../../api';
import type { AddMediaStoreState, ScrapeWorkerState } from '../../types';

export type { AddMediaStoreState, ScrapeWorkerState };

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

export const useAddMediaStore = create<AddMediaStoreState>((set, get) => ({
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
    const { tmdbType, tmdbId, includeSpecials } = get();

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
      const data = await fetchSeriesTmdbPreview(tmdbType, parsedId, includeSpecials);
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

/** Backward-compatibility alias for the catalog add media dialog store. */
export const useScrapeWorkerStore = useAddMediaStore;
