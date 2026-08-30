import { create } from 'zustand';
import {
  previewScrape,
  previewScrapeSeries,
  fetchSeriesTmdbPreview,
  type PreviewScrapeResult,
  type PreviewScrapeSeriesResult,
  type TmdbPreviewResult,
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
  id?: string;
  title: string;
  url: string;
  date: string | null;
  embedUrl?: string;
}

export interface ScrapeWorkerState {
  isOpen: boolean;
  step: 1 | 2;
  sourceUrl: string;
  source: 'otakudesu' | 'tmdb';
  tmdbType: 'tv' | 'movie';
  tmdbId: string;
  tmdbPreviewData: TmdbPreviewResult | null;
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
  setSource: (source: 'otakudesu' | 'tmdb') => void;
  setTmdbType: (tmdbType: 'tv' | 'movie') => void;
  setTmdbId: (tmdbId: string) => void;
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
  addEditablePreviewEpisode: () => void;
  deleteEditablePreviewEpisode: (index: number) => void;
  reorderEditablePreviewEpisodes: (
    sourceIndex: number,
    destinationIndex: number
  ) => void;
}

const initialState = {
  isOpen: false,
  step: 1 as const,
  sourceUrl: '',
  source: 'otakudesu' as const,
  tmdbType: 'tv' as const,
  tmdbId: '',
  tmdbPreviewData: null,
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
  setSource: (source: 'otakudesu' | 'tmdb') => set({ source, error: null }),
  setTmdbType: (tmdbType: 'tv' | 'movie') => set({ tmdbType, error: null }),
  setTmdbId: (tmdbId: string) => set({ tmdbId, error: null }),
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
  addEditablePreviewEpisode: () =>
    set((state) => ({
      editablePreviewEpisodes: [
        ...(state.editablePreviewEpisodes || []),
        {
          id: `ep-draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: '',
          url: '',
          date: null,
        },
      ],
    })),
  deleteEditablePreviewEpisode: (index) =>
    set((state) => {
      if (!state.editablePreviewEpisodes) return {};
      const nextEpisodes = state.editablePreviewEpisodes.filter(
        (_, i) => i !== index
      );
      return { editablePreviewEpisodes: nextEpisodes };
    }),
  reorderEditablePreviewEpisodes: (sourceIndex, destinationIndex) =>
    set((state) => {
      if (!state.editablePreviewEpisodes) return {};
      if (
        sourceIndex < 0 ||
        sourceIndex >= state.editablePreviewEpisodes.length ||
        destinationIndex < 0 ||
        destinationIndex >= state.editablePreviewEpisodes.length
      ) {
        return {};
      }
      const nextEpisodes = [...state.editablePreviewEpisodes];
      const [removed] = nextEpisodes.splice(sourceIndex, 1);
      nextEpisodes.splice(destinationIndex, 0, removed);
      return { editablePreviewEpisodes: nextEpisodes };
    }),

  submitPreview: async () => {
    const { sourceUrl, source, tmdbType, tmdbId } = get();

    if (source === 'tmdb') {
      if (!tmdbId.trim()) {
        set({ error: 'TMDB ID is required.' });
        return false;
      }

      const parsedId = parseInt(tmdbId.trim(), 10);
      if (Number.isNaN(parsedId) || parsedId <= 0) {
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
    }

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
            ? data.episodes.map((ep, idx) => ({
                id: `ep-draft-${idx}-${Math.random().toString(36).slice(2, 7)}`,
                ...ep,
              }))
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
