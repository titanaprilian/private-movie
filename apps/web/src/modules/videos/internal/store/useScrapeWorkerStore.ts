import { create } from 'zustand';
import {
  previewScrape,
  type PreviewScrapeResult,
} from '../api';

export interface ScrapeWorkerState {
  isOpen: boolean;
  step: 1 | 2;
  sourceUrl: string;
  source: 'otakudesu';
  html: string;
  isLoading: boolean;
  error: string | null;
  previewData: PreviewScrapeResult | null;

  // Actions
  openDialog: () => void;
  closeDialog: () => void;
  reset: () => void;
  setSourceUrl: (sourceUrl: string) => void;
  setSource: (source: 'otakudesu') => void;
  setHtml: (html: string) => void;
  setStep: (step: 1 | 2) => void;
  backToStep1: () => void;
  submitPreview: () => Promise<boolean>;
}

const initialState = {
  isOpen: false,
  step: 1 as const,
  sourceUrl: '',
  source: 'otakudesu' as const,
  html: '',
  isLoading: false,
  error: null,
  previewData: null,
};

export const useScrapeWorkerStore = create<ScrapeWorkerState>((set, get) => ({
  ...initialState,

  openDialog: () => set({ isOpen: true }),
  closeDialog: () => set({ isOpen: false }),
  reset: () => set({ ...initialState }),
  setSourceUrl: (sourceUrl: string) => set({ sourceUrl, error: null }),
  setSource: (source: 'otakudesu') => set({ source, error: null }),
  setHtml: (html: string) => set({ html, error: null }),
  setStep: (step: 1 | 2) => set({ step }),
  backToStep1: () => set({ step: 1 }),

  submitPreview: async () => {
    const { sourceUrl, source, html } = get();

    if (!sourceUrl.trim() || !html.trim()) {
      set({ error: 'Source URL and HTML content are required.' });
      return false;
    }

    set({ isLoading: true, error: null });

    try {
      const data = await previewScrape({
        sourceUrl: sourceUrl.trim(),
        source,
        html,
      });

      set({
        isLoading: false,
        previewData: data,
        step: 2,
        error: null,
      });
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to parse page HTML';
      set({
        isLoading: false,
        error: message,
        previewData: null,
        step: 1,
      });
      return false;
    }
  },
}));
