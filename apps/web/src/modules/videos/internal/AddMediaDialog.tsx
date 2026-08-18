import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  useScrapeWorkerStore,
  type EditableEpisodeDraft,
} from './store/useScrapeWorkerStore';
import { saveMedia, previewScrape, type VideoSourceInput } from './api';

export function AddMediaDialog() {
  const queryClient = useQueryClient();

  const isOpen = useScrapeWorkerStore((state) => state.isOpen);
  const step = useScrapeWorkerStore((state) => state.step);
  const sourceUrl = useScrapeWorkerStore((state) => state.sourceUrl);
  const source = useScrapeWorkerStore((state) => state.source);
  const isLoading = useScrapeWorkerStore((state) => state.isLoading);
  const error = useScrapeWorkerStore((state) => state.error);
  const previewData = useScrapeWorkerStore((state) => state.previewData);
  const seriesPreviewData = useScrapeWorkerStore((state) => state.seriesPreviewData);
  const editablePreviewSeries = useScrapeWorkerStore((state) => state.editablePreviewSeries);
  const editablePreviewEpisodes = useScrapeWorkerStore((state) => state.editablePreviewEpisodes);
  const isBatch = useScrapeWorkerStore((state) => state.isBatch);

  const closeDialogStore = useScrapeWorkerStore((state) => state.closeDialog);
  const resetStore = useScrapeWorkerStore((state) => state.reset);
  const setSourceUrl = useScrapeWorkerStore((state) => state.setSourceUrl);
  const setSource = useScrapeWorkerStore((state) => state.setSource);
  const submitPreview = useScrapeWorkerStore((state) => state.submitPreview);
  const backToStep1 = useScrapeWorkerStore((state) => state.backToStep1);
  const updateEditablePreviewSeries = useScrapeWorkerStore((state) => state.updateEditablePreviewSeries);
  const updateEditablePreviewEpisode = useScrapeWorkerStore((state) => state.updateEditablePreviewEpisode);
  const addEditablePreviewEpisode = useScrapeWorkerStore((state) => state.addEditablePreviewEpisode);
  const deleteEditablePreviewEpisode = useScrapeWorkerStore((state) => state.deleteEditablePreviewEpisode);

  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  const [missingFieldsPrompt, setMissingFieldsPrompt] = useState<{
    index: number;
    missingFields: string[];
  } | null>(null);
  const [missingFieldsInputs, setMissingFieldsInputs] = useState<
    Record<string, string>
  >({});

  const isBatchSaving = batchProgress !== null || missingFieldsPrompt !== null;

  const closeDialog = () => {
    setMissingFieldsPrompt(null);
    setMissingFieldsInputs({});
    setBatchProgress(null);
    setBatchError(null);
    closeDialogStore();
  };

  const reset = () => {
    setMissingFieldsPrompt(null);
    setMissingFieldsInputs({});
    setBatchProgress(null);
    setBatchError(null);
    resetStore();
  };

  const saveMutation = useMutation({
    mutationFn: saveMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success('Media saved successfully');
      reset();
    },
  });

  const runBatchSave = async (startIndex: number) => {
    const episodesList = editablePreviewEpisodes || seriesPreviewData?.episodes;
    if (!episodesList || !episodesList.length || !seriesPreviewData) return;

    const total = episodesList.length;
    setBatchProgress({ current: startIndex + 1, total });
    setBatchError(null);

    try {
      for (let i = startIndex; i < total; i++) {
        const ep = episodesList[i] as EditableEpisodeDraft;
        setBatchProgress({ current: i + 1, total });

        let episodePayload: {
          sourceUrl: string;
          source: string;
          title: string;
          videoType: string | null;
          videoSources?: VideoSourceInput[];
          metadata: Record<string, unknown>;
        };

        if (ep.embedUrl?.trim()) {
          episodePayload = {
            sourceUrl: ep.url,
            source: seriesPreviewData.series.source,
            title: ep.title,
            videoType: null,
            videoSources: [
              {
                type: 'embed',
                url: ep.embedUrl.trim(),
                label: 'Manual',
              },
            ],
            metadata: {},
          };
        } else {
          try {
            const epData = await previewScrape({
              sourceUrl: ep.url,
              source: seriesPreviewData.series.source,
            });
            episodePayload = {
              ...epData.episode,
              title: ep.title,
              sourceUrl: ep.url,
            };
          } catch (err: unknown) {
            const errObj = err as {
              code?: string;
              missingFields?: string[];
              error?: { code?: string; missingFields?: string[] };
            };
            const code = errObj?.code || errObj?.error?.code;
            const fields = errObj?.missingFields || errObj?.error?.missingFields;

            if (
              code === 'EPISODE_MISSING_FIELDS' ||
              (Array.isArray(fields) && fields.length > 0)
            ) {
              const missingFieldsList =
                Array.isArray(fields) && fields.length > 0
                  ? fields
                  : ['title', 'embedUrl'];
              const initialInputs: Record<string, string> = {};
              for (const field of missingFieldsList) {
                initialInputs[field] = '';
              }
              setMissingFieldsInputs(initialInputs);
              setMissingFieldsPrompt({
                index: i,
                missingFields: missingFieldsList,
              });
              return;
            }
            throw err;
          }
        }

        if (ep.date) {
          episodePayload.metadata = {
            ...episodePayload.metadata,
            publishedDate: ep.date,
          };
        }

        const seriesPayload = editablePreviewSeries
          ? {
              sourceUrl: editablePreviewSeries.sourceUrl,
              source: editablePreviewSeries.source,
              title: editablePreviewSeries.title,
              description: editablePreviewSeries.description,
              posterUrl: editablePreviewSeries.posterUrl,
            }
          : {
              sourceUrl: seriesPreviewData.series.sourceUrl,
              source: seriesPreviewData.series.source,
              title: seriesPreviewData.series.title,
              description: seriesPreviewData.series.description,
              posterUrl: seriesPreviewData.series.posterUrl,
            };

        await saveMedia({
          episode: episodePayload,
          series: seriesPayload,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success('Media saved successfully');
      reset();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save batch episodes';
      setBatchError(msg);
      setBatchProgress(null);
    }
  };

  const handleBatchSave = async () => {
    await runBatchSave(0);
  };

  const handleContinueMissingFields = async () => {
    const episodesList = editablePreviewEpisodes || seriesPreviewData?.episodes;
    if (!missingFieldsPrompt || !episodesList || !seriesPreviewData) return;

    const { index } = missingFieldsPrompt;
    const ep = episodesList[index];

    const titleValue = missingFieldsInputs['title'] || ep.title;
    const embedUrlValue = missingFieldsInputs['embedUrl'];

    const videoSources: VideoSourceInput[] = [];
    if (embedUrlValue) {
      videoSources.push({
        type: 'embed',
        url: embedUrlValue,
        label: 'Manual',
      });
    }

    const episodePayload = {
      sourceUrl: ep.url,
      source: seriesPreviewData.series.source,
      title: titleValue,
      videoType: missingFieldsInputs['videoType'] || null,
      videoSources: videoSources.length > 0 ? videoSources : undefined,
      metadata: {
        ...(ep.date ? { publishedDate: ep.date } : {}),
        ...Object.fromEntries(
          Object.entries(missingFieldsInputs).filter(
            ([k]) => k !== 'title' && k !== 'embedUrl' && k !== 'videoType'
          )
        ),
      },
    };

    setMissingFieldsPrompt(null);
    setMissingFieldsInputs({});

    try {
      const seriesPayload = editablePreviewSeries
        ? {
            sourceUrl: editablePreviewSeries.sourceUrl,
            source: editablePreviewSeries.source,
            title: editablePreviewSeries.title,
            description: editablePreviewSeries.description,
            posterUrl: editablePreviewSeries.posterUrl,
          }
        : {
            sourceUrl: seriesPreviewData.series.sourceUrl,
            source: seriesPreviewData.series.source,
            title: seriesPreviewData.series.title,
            description: seriesPreviewData.series.description,
            posterUrl: seriesPreviewData.series.posterUrl,
          };

      await saveMedia({
        episode: episodePayload,
        series: seriesPayload,
      });

      await runBatchSave(index + 1);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save batch episodes';
      setBatchError(msg);
      setBatchProgress(null);
    }
  };

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
                ? 'Input source URL for scraping.'
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
          ) : isBatch ? (
            <div className="space-y-5">
              {/* Batch Saving Progress */}
              {batchProgress && (
                <div className="p-3 rounded border border-primary/30 bg-primary/10 text-xs mono space-y-2">
                  <div className="flex items-center justify-between text-primary font-medium">
                    <span>
                      Saving episode {batchProgress.current} of{' '}
                      {batchProgress.total}...
                    </span>
                    <span>
                      {Math.round(
                        (batchProgress.current / batchProgress.total) * 100
                      )}
                      %
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-card border border-c rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{
                        width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Missing Fields Pause Form */}
              {missingFieldsPrompt && (
                <div className="p-4 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 space-y-4">
                  <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800/60 pb-2">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
                      </svg>
                      <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                        Missing Required Fields (Episode #{missingFieldsPrompt.index + 1})
                      </span>
                    </div>
                    <span className="text-[10px] mono px-2 py-0.5 rounded bg-amber-200/50 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                      Batch Paused
                    </span>
                  </div>

                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    Scraping missing mandatory parameters for episode link{' '}
                    <code className="mono bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">
                      {seriesPreviewData?.episodes[missingFieldsPrompt.index]?.url}
                    </code>
                    . Provide values below to resume batch save.
                  </p>

                  <div className="space-y-3">
                    {missingFieldsPrompt.missingFields.map((field) => (
                      <div key={field}>
                        <label
                          htmlFor={`missing-field-${field}`}
                          className="text-xs mono uppercase tracking-wide font-medium text-amber-900 dark:text-amber-200 mb-1 block"
                        >
                          {field}
                        </label>
                        <input
                          id={`missing-field-${field}`}
                          name={field}
                          aria-label={field}
                          type="text"
                          placeholder={`Enter ${field}...`}
                          value={missingFieldsInputs[field] || ''}
                          onChange={(e) =>
                            setMissingFieldsInputs((prev) => ({
                              ...prev,
                              [field]: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded border border-amber-300 dark:border-amber-700 bg-card text-xs mono focus:outline-none focus:border-primary"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void handleContinueMissingFields()}
                      disabled={missingFieldsPrompt.missingFields.some(
                        (field) => !missingFieldsInputs[field]?.trim()
                      )}
                      className="px-4 py-1.5 rounded bg-primary text-primary-fg text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Series Card */}
              {editablePreviewSeries && (
                <div className="bg-card border border-c rounded p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-c pb-2">
                    <span className="text-[10px] mono uppercase tracking-wider font-semibold text-muted">
                      Parsed Series Metadata
                    </span>
                    {seriesPreviewData?.episodes && (
                      <span className="text-[10px] mono px-2 py-0.5 rounded bg-muted/20 border border-c text-muted">
                        {seriesPreviewData.episodes.length} Episodes
                      </span>
                    )}
                  </div>

                  <div className="flex gap-4">
                    {editablePreviewSeries.posterUrl && (
                      <img
                        src={editablePreviewSeries.posterUrl}
                        alt={editablePreviewSeries.title}
                        className="w-16 h-24 object-cover rounded border border-c shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0 space-y-3">
                      <div>
                        <label
                          htmlFor="series-title-batch"
                          className="text-[10px] mono uppercase tracking-wider font-semibold text-muted mb-1 block"
                        >
                          Series Title
                        </label>
                        <input
                          id="series-title-batch"
                          aria-label="Series Title"
                          type="text"
                          value={editablePreviewSeries.title}
                          onChange={(e) =>
                            updateEditablePreviewSeries({
                              title: e.target.value,
                            })
                          }
                          className="w-full px-3 py-1.5 rounded border border-c bg-transparent text-xs mono focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="series-description-batch"
                          className="text-[10px] mono uppercase tracking-wider font-semibold text-muted mb-1 block"
                        >
                          Description
                        </label>
                        <textarea
                          id="series-description-batch"
                          aria-label="Description"
                          value={editablePreviewSeries.description || ''}
                          onChange={(e) =>
                            updateEditablePreviewSeries({
                              description: e.target.value || null,
                            })
                          }
                          rows={2}
                          className="w-full px-3 py-1.5 rounded border border-c bg-transparent text-xs focus:outline-none focus:border-primary resize-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="series-poster-url-batch"
                          className="text-[10px] mono uppercase tracking-wider font-semibold text-muted mb-1 block"
                        >
                          Poster URL
                        </label>
                        <input
                          id="series-poster-url-batch"
                          aria-label="Poster URL"
                          type="text"
                          value={editablePreviewSeries.posterUrl || ''}
                          onChange={(e) =>
                            updateEditablePreviewSeries({
                              posterUrl: e.target.value || null,
                            })
                          }
                          className="w-full px-3 py-1.5 rounded border border-c bg-transparent text-xs mono focus:outline-none focus:border-primary"
                        />
                      </div>

                      <p className="text-xs mono text-muted mt-1 truncate">
                        Series URL: {editablePreviewSeries.sourceUrl}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Extracted Episodes List / Table */}
              {(editablePreviewEpisodes || seriesPreviewData?.episodes) && (
                <div className="bg-card border border-c rounded p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-c pb-2">
                    <span className="text-[10px] mono uppercase tracking-wider font-semibold text-muted">
                      Extracted Batch Episodes (
                      {(editablePreviewEpisodes || seriesPreviewData!.episodes).length})
                    </span>
                  </div>
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {(editablePreviewEpisodes || seriesPreviewData!.episodes).map((ep: EditableEpisodeDraft, i) => (
                      <div
                        key={i}
                        className="p-3 bg-sidebar rounded border border-c space-y-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] mono text-muted shrink-0 font-semibold">
                            #{i + 1}
                          </span>
                          <div className="flex-1">
                            <input
                              id={`episode-title-${i}`}
                              aria-label={`Episode Title #${i + 1}`}
                              type="text"
                              value={ep.title}
                              onChange={(e) =>
                                updateEditablePreviewEpisode(i, {
                                  title: e.target.value,
                                })
                              }
                              placeholder="Episode Title"
                              className="w-full px-2.5 py-1 rounded border border-c bg-card text-xs font-semibold focus:outline-none focus:border-primary"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteEditablePreviewEpisode(i)}
                            aria-label={`Delete episode #${i + 1}`}
                            title="Delete episode"
                            className="p-1 rounded hover-bg border border-c text-muted hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer shrink-0"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label
                              htmlFor={`episode-date-${i}`}
                              className="text-[9px] mono uppercase text-muted block mb-0.5"
                            >
                              Date
                            </label>
                            <input
                              id={`episode-date-${i}`}
                              aria-label={`Episode Date #${i + 1}`}
                              type="text"
                              value={ep.date || ''}
                              onChange={(e) =>
                                updateEditablePreviewEpisode(i, {
                                  date: e.target.value || null,
                                })
                              }
                              placeholder="Publish Date (optional)"
                              className="w-full px-2.5 py-1 rounded border border-c bg-card text-xs mono text-muted focus:outline-none focus:border-primary"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`episode-url-${i}`}
                              className="text-[9px] mono uppercase text-muted block mb-0.5"
                            >
                              Source URL
                            </label>
                            <input
                              id={`episode-url-${i}`}
                              aria-label={`Episode URL #${i + 1}`}
                              type="text"
                              value={ep.url}
                              onChange={(e) =>
                                updateEditablePreviewEpisode(i, {
                                  url: e.target.value,
                                })
                              }
                              placeholder="https://..."
                              className="w-full px-2.5 py-1 rounded border border-c bg-card text-xs mono text-muted focus:outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                        <div>
                          <label
                            htmlFor={`episode-embed-url-${i}`}
                            className="text-[9px] mono uppercase text-muted block mb-0.5"
                          >
                            Embed URL (optional)
                          </label>
                          <input
                            id={`episode-embed-url-${i}`}
                            aria-label={`Embed URL #${i + 1}`}
                            type="text"
                            value={ep.embedUrl || ''}
                            onChange={(e) =>
                              updateEditablePreviewEpisode(i, {
                                embedUrl: e.target.value,
                              })
                            }
                            placeholder="https://embed... (bypasses scrape)"
                            className="w-full px-2.5 py-1 rounded border border-c bg-card text-xs mono text-muted focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addEditablePreviewEpisode()}
                      className="w-full py-2 rounded border border-dashed border-c text-xs mono font-medium text-muted hover:text-fg hover-bg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      + Add Episode
                    </button>
                  </div>
                </div>
              )}

              {/* Batch Error */}
              {batchError && (
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
                  <span>{batchError}</span>
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
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {previewData.episode.videoSources.map((src, i) => (
                          <div key={i} className="p-2 bg-sidebar rounded border border-c text-xs mono flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 truncate">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-medium shrink-0 ${
                                src.type === 'direct'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-800'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-800'
                              }`}>
                                {src.type}
                              </span>
                              <span className="font-semibold truncate">{src.label}</span>
                              {src.quality && (
                                <span className="text-muted text-[10px] shrink-0">({src.quality})</span>
                              )}
                            </div>
                            <span className="text-muted truncate max-w-[200px]" title={src.url}>{src.url}</span>
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
              {editablePreviewSeries ? (
                <div className="bg-card border border-c rounded p-4 space-y-3">
                  <div className="border-b border-c pb-2">
                    <span className="text-[10px] mono uppercase tracking-wider font-semibold text-muted">
                      Parsed Series
                    </span>
                  </div>

                  <div className="flex gap-4">
                    {editablePreviewSeries.posterUrl && (
                      <img
                        src={editablePreviewSeries.posterUrl}
                        alt={editablePreviewSeries.title}
                        className="w-16 h-24 object-cover rounded border border-c shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0 space-y-3">
                      <div>
                        <label
                          htmlFor="series-title"
                          className="text-[10px] mono uppercase tracking-wider font-semibold text-muted mb-1 block"
                        >
                          Series Title
                        </label>
                        <input
                          id="series-title"
                          aria-label="Series Title"
                          type="text"
                          value={editablePreviewSeries.title}
                          onChange={(e) =>
                            updateEditablePreviewSeries({
                              title: e.target.value,
                            })
                          }
                          className="w-full px-3 py-1.5 rounded border border-c bg-transparent text-xs mono focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="series-description"
                          className="text-[10px] mono uppercase tracking-wider font-semibold text-muted mb-1 block"
                        >
                          Description
                        </label>
                        <textarea
                          id="series-description"
                          aria-label="Description"
                          value={editablePreviewSeries.description || ''}
                          onChange={(e) =>
                            updateEditablePreviewSeries({
                              description: e.target.value || null,
                            })
                          }
                          rows={2}
                          className="w-full px-3 py-1.5 rounded border border-c bg-transparent text-xs focus:outline-none focus:border-primary resize-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="series-poster-url"
                          className="text-[10px] mono uppercase tracking-wider font-semibold text-muted mb-1 block"
                        >
                          Poster URL
                        </label>
                        <input
                          id="series-poster-url"
                          aria-label="Poster URL"
                          type="text"
                          value={editablePreviewSeries.posterUrl || ''}
                          onChange={(e) =>
                            updateEditablePreviewSeries({
                              posterUrl: e.target.value || null,
                            })
                          }
                          className="w-full px-3 py-1.5 rounded border border-c bg-transparent text-xs mono focus:outline-none focus:border-primary"
                        />
                      </div>

                      <p className="text-xs mono text-muted mt-1 truncate">
                        Series URL: {editablePreviewSeries.sourceUrl}
                      </p>
                    </div>
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
                disabled={isLoading || !sourceUrl.trim()}
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
                {isLoading ? 'Resolving mirrors...' : 'Preview Scrape'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={backToStep1}
                disabled={saveMutation.isPending || isBatchSaving}
                className="px-3.5 py-1.5 rounded border border-c text-xs font-medium hover-bg transition-colors cursor-pointer disabled:opacity-50"
              >
                ← Back to Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isBatch) {
                    void handleBatchSave();
                  } else if (previewData?.episode) {
                    saveMutation.mutate({
                      episode: previewData.episode,
                      series: editablePreviewSeries
                        ? {
                            sourceUrl: editablePreviewSeries.sourceUrl,
                            source: editablePreviewSeries.source,
                            title: editablePreviewSeries.title,
                            description: editablePreviewSeries.description,
                            posterUrl: editablePreviewSeries.posterUrl,
                          }
                        : previewData.series,
                    });
                  }
                }}
                disabled={
                  isBatch
                    ? isBatchSaving || !seriesPreviewData?.episodes.length
                    : saveMutation.isPending || !previewData?.episode
                }
                className="px-4 py-1.5 rounded bg-primary text-primary-fg text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {(saveMutation.isPending || isBatchSaving) && (
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
                {batchProgress
                  ? `Saving (${batchProgress.current}/${batchProgress.total})...`
                  : saveMutation.isPending
                    ? 'Saving...'
                    : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
