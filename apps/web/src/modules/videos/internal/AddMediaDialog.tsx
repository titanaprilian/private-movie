import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useScrapeWorkerStore } from './store/useScrapeWorkerStore';
import { saveMedia } from './api';

export function AddMediaDialog() {
  const queryClient = useQueryClient();

  const isOpen = useScrapeWorkerStore((state) => state.isOpen);
  const step = useScrapeWorkerStore((state) => state.step);
  const sourceUrl = useScrapeWorkerStore((state) => state.sourceUrl);
  const source = useScrapeWorkerStore((state) => state.source);
  const html = useScrapeWorkerStore((state) => state.html);
  const isLoading = useScrapeWorkerStore((state) => state.isLoading);
  const error = useScrapeWorkerStore((state) => state.error);
  const previewData = useScrapeWorkerStore((state) => state.previewData);

  const closeDialog = useScrapeWorkerStore((state) => state.closeDialog);
  const reset = useScrapeWorkerStore((state) => state.reset);
  const setSourceUrl = useScrapeWorkerStore((state) => state.setSourceUrl);
  const setSource = useScrapeWorkerStore((state) => state.setSource);
  const setHtml = useScrapeWorkerStore((state) => state.setHtml);
  const submitPreview = useScrapeWorkerStore((state) => state.submitPreview);
  const backToStep1 = useScrapeWorkerStore((state) => state.backToStep1);

  const saveMutation = useMutation({
    mutationFn: saveMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success('Media saved successfully');
      reset();
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
                Add Media Wizard
              </h2>
              <span className="text-[10px] mono px-2 py-0.5 rounded border border-c bg-card text-muted">
                Step {step} of 2
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              {step === 1
                ? 'Input source URL and raw HTML content for scraping.'
                : 'Read-only preview of parsed metadata and warnings.'}
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
                  htmlFor="media-source-url"
                  className="text-xs mono uppercase tracking-wide text-muted font-medium mb-1.5 block"
                >
                  Source URL
                </label>
                <input
                  id="media-source-url"
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://otakudesu.cloud/episode/..."
                  className="w-full px-3 py-2 rounded border border-c bg-transparent text-xs mono focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="media-source-provider"
                  className="text-xs mono uppercase tracking-wide text-muted font-medium mb-1.5 block"
                >
                  Source Provider
                </label>
                <select
                  id="media-source-provider"
                  value={source}
                  onChange={(e) =>
                    setSource(e.target.value as 'otakudesu')
                  }
                  className="w-full px-3 py-2 rounded border border-c bg-card text-xs mono focus:outline-none focus:border-primary"
                >
                  <option value="otakudesu">Otakudesu</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="media-raw-html"
                  className="text-xs mono uppercase tracking-wide text-muted font-medium mb-1.5 block"
                >
                  Raw HTML Content
                </label>
                <textarea
                  id="media-raw-html"
                  rows={10}
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  placeholder="Paste page HTML source code here..."
                  className="w-full px-3 py-2 rounded border border-c bg-transparent text-xs mono focus:outline-none focus:border-primary resize-y"
                />
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
              {/* Warnings */}
              {previewData?.warnings && previewData.warnings.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] mono uppercase tracking-wider font-semibold text-muted">
                    Backend Warnings
                  </span>
                  {previewData.warnings.map((warning, index) => (
                    <div
                      key={index}
                      className="p-3 rounded border border-amber-200 dark:border-amber-900/50 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2"
                    >
                      <svg
                        className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
                      </svg>
                      <span className="mono">{warning}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Episode Summary Card */}
              {previewData?.episode && (
                <div className="bg-card border border-c rounded p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-c pb-2">
                    <span className="text-[10px] mono uppercase tracking-wider font-semibold text-muted">
                      Parsed Episode
                    </span>
                    {previewData.episode.videoType && (
                      <span className="text-[10px] mono px-2 py-0.5 rounded bg-muted/20 border border-c text-muted">
                        {previewData.episode.videoType}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-current">
                      {previewData.episode.title}
                    </h3>
                    <p className="text-xs mono text-muted mt-0.5 truncate">
                      Source: {previewData.episode.sourceUrl}
                    </p>
                  </div>

                  {previewData.episode.videoSources && previewData.episode.videoSources.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[10px] mono uppercase tracking-wider text-muted block mb-1">
                        Video Sources ({previewData.episode.videoSources.length})
                      </span>
                      <div className="space-y-1.5">
                        {previewData.episode.videoSources.map((src, i) => (
                          <div key={i} className="p-2 bg-sidebar rounded border border-c text-xs mono flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 truncate">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-medium ${
                                src.type === 'direct'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-800'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-800'
                              }`}>
                                {src.type}
                              </span>
                              <span className="font-semibold">{src.label}</span>
                              {src.quality && (
                                <span className="text-muted text-[10px]">({src.quality})</span>
                              )}
                            </div>
                            <span className="text-muted truncate max-w-[200px]">{src.url}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {previewData.episode.metadata && (
                    <div className="pt-2">
                      <span className="text-[10px] mono uppercase tracking-wider text-muted block mb-1">
                        Episode Metadata
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-xs mono p-2.5 bg-sidebar rounded border border-c">
                        {Object.entries(previewData.episode.metadata).map(
                          ([key, value]) => (
                            <div key={key} className="overflow-hidden">
                              <span className="text-muted block text-[10px]">
                                {key}
                              </span>
                              <span className="font-medium text-current truncate block">
                                {typeof value === 'object'
                                  ? JSON.stringify(value)
                                  : String(value ?? '-')}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Series Summary Card */}
              {previewData?.series ? (
                <div className="bg-card border border-c rounded p-4 space-y-3">
                  <div className="border-b border-c pb-2">
                    <span className="text-[10px] mono uppercase tracking-wider font-semibold text-muted">
                      Parsed Series
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-current">
                      {previewData.series.title}
                    </h3>
                    {previewData.series.description && (
                      <p className="text-xs text-muted mt-1 leading-relaxed">
                        {previewData.series.description}
                      </p>
                    )}
                    <p className="text-xs mono text-muted mt-1 truncate">
                      Series URL: {previewData.series.sourceUrl}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded border border-c bg-sidebar text-xs mono text-muted italic">
                  No linked series metadata parsed from this episode page.
                </div>
              )}
              {/* Save Mutation Error */}
              {saveMutation.error && (
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
                    {saveMutation.error instanceof Error
                      ? saveMutation.error.message
                      : 'Failed to save media'}
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
                disabled={isLoading || !sourceUrl.trim() || !html.trim()}
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
                {isLoading ? 'Scraping...' : 'Preview Scrape'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={backToStep1}
                disabled={saveMutation.isPending}
                className="px-3.5 py-1.5 rounded border border-c text-xs font-medium hover-bg transition-colors cursor-pointer disabled:opacity-50"
              >
                ← Back to Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  if (previewData?.episode) {
                    saveMutation.mutate({
                      episode: previewData.episode,
                      series: previewData.series,
                    });
                  }
                }}
                disabled={saveMutation.isPending || !previewData?.episode}
                className="px-4 py-1.5 rounded bg-primary text-primary-fg text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {saveMutation.isPending && (
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
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
