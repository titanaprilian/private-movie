import { create } from 'zustand';
import {
  previewScrape,
  previewScrapeSeries,
  type PreviewScrapeResult,
  type PreviewScrapeSeriesResult,
} from '../api';

export const isSeriesUrl = (url: string) => /\/anime\//i.test(url);

export interface EditableSeriesDraft {
  sourceUrl: string;
  source: string;
  title: string;
  description: string | null;
  posterUrl: string | null;
}

export interface EditableEpisodeDraft {
  title: string;
  url: string;
  date: string | null;
}

export interface ScrapeWorkerState {
  isOpen: boolean;
  step: 1 | 2;
  sourceUrl: string;
  source: 'otakudesu';
  isLoading: boolean;
  error: string | null;
  previewData: PreviewScrapeResult | null;
  seriesPreviewData: PreviewScrapeSeriesResult | null;
  editablePreviewSeries: EditableSeriesDraft | null;
  editablePreviewEpisodes: EditableEpisodeDraft[] | null;
  isBatch: boolean;

  // Actions
  openDialog: () => void;
  closeDialog: () => void;
  reset: () => void;
  setSourceUrl: (sourceUrl: string) => void;
  setSource: (source: 'otakudesu') => void;
  setStep: (step: 1 | 2) => void;
  backToStep1: () => void;
  submitPreview: () => Promise<boolean>;
  setEditablePreviewSeries: (series: EditableSeriesDraft | null) => void;
  updateEditablePreviewSeries: (updates: Partial<EditableSeriesDraft>) => void;
  setEditablePreviewEpisodes: (episodes: EditableEpisodeDraft[] | null) => void;
  updateEditablePreviewEpisode: (
    index: number,
    updates: Partial<EditableEpisodeDraft>
  ) => void;
}

const initialState = {
  isOpen: false,
  step: 1 as const,
  sourceUrl: '',
  source: 'otakudesu' as const,
  isLoading: false,
  error: null,
  previewData: null,
  seriesPreviewData: null,
  editablePreviewSeries: null,
  editablePreviewEpisodes: null,
  isBatch: false,
};

export const useScrapeWorkerStore = create<ScrapeWorkerState>((set, get) => ({
  ...initialState,

  openDialog: () => set({ isOpen: true }),
  closeDialog: () => set({ isOpen: false }),
  reset: () => set({ ...initialState }),
  setSourceUrl: (sourceUrl: string) => set({ sourceUrl, error: null }),
  setSource: (source: 'otakudesu') => set({ source, error: null }),
  setStep: (step: 1 | 2) => set({ step }),
  backToStep1: () => set({ step: 1 }),
  setEditablePreviewSeries: (series) => set({ editablePreviewSeries: series }),
  updateEditablePreviewSeries: (updates) =>
    set((state) => ({
      editablePreviewSeries: state.editablePreviewSeries
        ? { ...state.editablePreviewSeries, ...updates }
        : null,
    })),
  setEditablePreviewEpisodes: (episodes) => set({ editablePreviewEpisodes: episodes }),
  updateEditablePreviewEpisode: (index, updates) =>
    set((state) => {
      if (!state.editablePreviewEpisodes) return {};
      const nextEpisodes = [...state.editablePreviewEpisodes];
      if (index >= 0 && index < nextEpisodes.length) {
        nextEpisodes[index] = { ...nextEpisodes[index], ...updates };
      }
      return { editablePreviewEpisodes: nextEpisodes };
    }),

  submitPreview: async () => {
    const { sourceUrl, source } = get();

    if (!sourceUrl.trim()) {
      set({ error: 'Source URL is required.' });
      return false;
    }

    const trimmedUrl = sourceUrl.trim();
    const isBatch = isSeriesUrl(trimmedUrl);

    set({ isLoading: true, error: null });

    try {
      if (isBatch) {
        const data = await previewScrapeSeries({
          sourceUrl: trimmedUrl,
          source,
        });

        set({
          isLoading: false,
          isBatch: true,
          seriesPreviewData: data,
          editablePreviewSeries: data.series ? { ...data.series } : null,
          editablePreviewEpisodes: data.episodes
            ? data.episodes.map((ep) => ({ ...ep }))
            : null,
          previewData: null,
          step: 2,
          error: null,
        });
      } else {
        const data = await previewScrape({
          sourceUrl: trimmedUrl,
          source,
        });

        set({
          isLoading: false,
          isBatch: false,
          previewData: data,
          editablePreviewSeries: data.series ? { ...data.series } : null,
          editablePreviewEpisodes: null,
          seriesPreviewData: null,
          step: 2,
          error: null,
        });
      }
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to preview scrape URL';
      set({
        isLoading: false,
        error: message,
        previewData: null,
        seriesPreviewData: null,
        editablePreviewSeries: null,
        editablePreviewEpisodes: null,
        isBatch: false,
        step: 1,
      });
      return false;
    }
  },
}));
