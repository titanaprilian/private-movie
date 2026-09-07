import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useScrapeWorkerStore } from './store/useScrapeWorkerStore';
import { importTmdb, type ImportTmdbParams } from './api';

export function AddMediaDialog() {
  const queryClient = useQueryClient();

  const isOpen = useScrapeWorkerStore((state) => state.isOpen);
  const step = useScrapeWorkerStore((state) => state.step);
  const tmdbType = useScrapeWorkerStore((state) => state.tmdbType);
  const tmdbId = useScrapeWorkerStore((state) => state.tmdbId);
  const includeSpecials = useScrapeWorkerStore((state) => state.includeSpecials);
  const tmdbPreviewData = useScrapeWorkerStore((state) => state.tmdbPreviewData);
  const isLoading = useScrapeWorkerStore((state) => state.isLoading);
  const error = useScrapeWorkerStore((state) => state.error);

  const resetStore = useScrapeWorkerStore((state) => state.reset);
  const setTmdbType = useScrapeWorkerStore((state) => state.setTmdbType);
  const setTmdbId = useScrapeWorkerStore((state) => state.setTmdbId);
  const setIncludeSpecials = useScrapeWorkerStore((state) => state.setIncludeSpecials);
  const submitPreview = useScrapeWorkerStore((state) => state.submitPreview);
  const backToStep1 = useScrapeWorkerStore((state) => state.backToStep1);

  const closeDialog = () => {
    resetStore();
  };

  const importTmdbMutation = useMutation({
    mutationFn: (params: ImportTmdbParams) => importTmdb(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      toast.success('Series imported successfully');
      closeDialog();
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-card border-l border-c h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-c flex items-center justify-between bg-sidebar">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">
                Add Series
              </h2>
              <span className="text-[10px] mono px-2 py-0.5 rounded border border-c bg-card text-muted">
                Step {step} of 2
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Add a new series to your catalog via TMDB.
            </p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Close dialog"
            className="p-1 rounded hover-bg border border-c text-muted hover:text-fg transition-colors cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="media-tmdb-type"
                  className="text-xs mono uppercase tracking-wide text-muted font-medium mb-1.5 block"
                >
                  Media Type
                </label>
                <select
                  id="media-tmdb-type"
                  value={tmdbType}
                  onChange={(e) => setTmdbType(e.target.value as 'tv' | 'movie')}
                  className="w-full px-3 py-2 rounded border border-c bg-card text-xs mono focus:outline-none focus:border-primary"
                >
                  <option value="tv">TV</option>
                  <option value="movie">Movie</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="media-tmdb-id"
                  className="text-xs mono uppercase tracking-wide text-muted font-medium mb-1.5 block"
                >
                  TMDB ID
                </label>
                <input
                  id="media-tmdb-id"
                  type="text"
                  value={tmdbId}
                  onChange={(e) => setTmdbId(e.target.value)}
                  placeholder="e.g. 1399"
                  className="w-full px-3 py-2 rounded border border-c bg-transparent text-xs mono focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="media-include-specials"
                  type="checkbox"
                  checked={includeSpecials}
                  onChange={(e) => setIncludeSpecials(e.target.checked)}
                  className="rounded border border-c accent-primary cursor-pointer w-4 h-4"
                />
                <label
                  htmlFor="media-include-specials"
                  className="text-xs mono text-muted select-none cursor-pointer"
                >
                  Include Specials
                </label>
              </div>

              {error && (
                <div className="p-3 rounded border border-red-200 dark:border-red-900/50 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs mono flex items-center gap-2">
                  <svg
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {tmdbPreviewData && (
                <div className="bg-card border border-c rounded p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-c pb-2">
                    <span className="text-[10px] mono uppercase tracking-wider font-semibold text-muted">
                      TMDB Snapshot Overview
                    </span>
                    <span className="text-[10px] mono px-2 py-0.5 rounded bg-muted/20 border border-c text-muted uppercase">
                      {tmdbType} • ID #{tmdbId}
                    </span>
                  </div>

                  <div className="flex gap-4">
                    {tmdbPreviewData.posterUrl && (
                      <img
                        src={tmdbPreviewData.posterUrl}
                        alt={tmdbPreviewData.title}
                        className="w-20 h-28 object-cover rounded border border-c shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0 space-y-2">
                      <h3 className="text-sm font-semibold text-current">
                        {tmdbPreviewData.title}
                      </h3>
                      <p className="text-xs text-muted leading-relaxed line-clamp-4">
                        {tmdbPreviewData.overview || 'No overview available.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {importTmdbMutation.error && (
                <div className="p-3 rounded border border-red-200 dark:border-red-900/50 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs mono flex items-center gap-2">
                  <svg
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>
                    {importTmdbMutation.error instanceof Error
                      ? importTmdbMutation.error.message
                      : 'Failed to import TMDB series'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="px-5 py-3 border-t border-c flex items-center justify-between bg-sidebar">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={closeDialog}
                className="px-3.5 py-1.5 rounded border border-c text-xs font-medium hover-bg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitPreview()}
                disabled={isLoading || !tmdbId.trim()}
                className="px-4 py-1.5 rounded bg-primary text-primary-fg text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isLoading && (
                  <svg
                    className="animate-spin w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                )}
                {isLoading ? 'Fetching preview...' : 'Next'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={backToStep1}
                disabled={importTmdbMutation.isPending}
                className="px-3.5 py-1.5 rounded border border-c text-xs font-medium hover-bg transition-colors cursor-pointer disabled:opacity-50"
              >
                ← Back to Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  importTmdbMutation.mutate({
                    type: tmdbType,
                    tmdbId: parseInt(tmdbId.trim(), 10),
                    includeSpecials,
                  });
                }}
                disabled={importTmdbMutation.isPending || !tmdbPreviewData}
                className="px-4 py-1.5 rounded bg-primary text-primary-fg text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {importTmdbMutation.isPending && (
                  <svg
                    className="animate-spin w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                )}
                {importTmdbMutation.isPending ? 'Importing...' : 'Import Series'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
