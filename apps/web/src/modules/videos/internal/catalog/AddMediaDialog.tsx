import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useScrapeWorkerStore } from '../store/useScrapeWorkerStore';
import { importTmdb, type ImportTmdbParams } from '../api';
import {
  ChunkyDrawer,
  ChunkyDrawerBody,
  ChunkyDrawerContent,
  ChunkyDrawerDescription,
  ChunkyDrawerFooter,
  ChunkyDrawerHeader,
  ChunkyDrawerTitle,
} from '@/components/ui/chunky-drawer';
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard } from '@/components/ui/chunky-card';

function Spinner() {
  return (
    <svg
      className="animate-spin w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
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
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="p-3 rounded-2xl border-2 border-[var(--red)] bg-[var(--red)]/10 text-[var(--red)] text-sm font-bold flex items-center gap-2">
      <svg
        className="w-4 h-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

function MetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-xs font-extrabold border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">
      {children}
    </span>
  );
}

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

  return (
    <ChunkyDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeDialog();
      }}
    >
      <ChunkyDrawerContent>
        <ChunkyDrawerHeader>
          <ChunkyDrawerTitle className="text-[28px] font-extrabold leading-tight">
            Add Series
          </ChunkyDrawerTitle>
          <span className="mt-1 inline-flex w-fit rounded-full border-2 border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-extrabold text-[var(--muted)]">
            Step {step} of 2
          </span>
          <ChunkyDrawerDescription className="text-[15px] font-semibold">
            Add a new series to your catalog via TMDB.
          </ChunkyDrawerDescription>
        </ChunkyDrawerHeader>

        <ChunkyDrawerBody className="space-y-5">
          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="media-tmdb-type"
                  className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
                >
                  Media Type
                </label>
                <ChunkySelect
                  value={tmdbType}
                  onValueChange={(val) => setTmdbType(val as 'tv' | 'movie')}
                >
                  <ChunkySelectTrigger id="media-tmdb-type" className="w-full">
                    <ChunkySelectValue placeholder="Select media type" />
                  </ChunkySelectTrigger>
                  <ChunkySelectContent>
                    <ChunkySelectItem value="tv">TV</ChunkySelectItem>
                    <ChunkySelectItem value="movie">Movie</ChunkySelectItem>
                  </ChunkySelectContent>
                </ChunkySelect>
              </div>

              <div>
                <label
                  htmlFor="media-tmdb-id"
                  className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
                >
                  TMDB ID
                </label>
                <ChunkyInput
                  id="media-tmdb-id"
                  type="text"
                  value={tmdbId}
                  onChange={(e) => setTmdbId(e.target.value)}
                  placeholder="e.g. 1399"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <ChunkyCheckbox
                  id="media-include-specials"
                  checked={includeSpecials}
                  onCheckedChange={setIncludeSpecials}
                />
                <label
                  htmlFor="media-include-specials"
                  className="text-sm font-bold text-[var(--muted)] select-none cursor-pointer"
                >
                  Include Specials
                </label>
              </div>

              {error && <ErrorBanner message={error} />}
            </div>
          ) : (
            <div className="space-y-4">
              {tmdbPreviewData && (
                <>
                  <ChunkyCard className="p-4 space-y-3">
                    <div className="flex items-center justify-between border-b-2 border-[var(--border)] pb-2">
                      <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                        TMDB Snapshot Overview
                      </span>
                      <MetaBadge>
                        {tmdbType} • ID #{tmdbId}
                      </MetaBadge>
                    </div>

                    <div className="flex gap-4">
                      {tmdbPreviewData.posterUrl && (
                        <img
                          src={tmdbPreviewData.posterUrl}
                          alt={tmdbPreviewData.title}
                          className="w-20 h-28 object-cover rounded-2xl border-2 border-[var(--border)] shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0 space-y-2">
                        <h3 className="font-display text-xl font-bold text-[var(--ink)]">
                          {tmdbPreviewData.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {tmdbPreviewData.releaseDate && (
                            <MetaBadge>{tmdbPreviewData.releaseDate}</MetaBadge>
                          )}
                          {tmdbType === 'movie' && typeof tmdbPreviewData.runtime === 'number' && (
                            <MetaBadge>{tmdbPreviewData.runtime} mins</MetaBadge>
                          )}
                          {tmdbType === 'tv' && (
                            <>
                              {tmdbPreviewData.status && (
                                <MetaBadge>{tmdbPreviewData.status}</MetaBadge>
                              )}
                              {typeof tmdbPreviewData.totalSeasons === 'number' && (
                                <MetaBadge>
                                  {tmdbPreviewData.totalSeasons} Seasons
                                </MetaBadge>
                              )}
                              {typeof tmdbPreviewData.totalEpisodes === 'number' && (
                                <MetaBadge>
                                  {tmdbPreviewData.totalEpisodes} Episodes
                                </MetaBadge>
                              )}
                            </>
                          )}
                        </div>
                        {tmdbPreviewData.genres && tmdbPreviewData.genres.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {tmdbPreviewData.genres.map((genre) => (
                              <MetaBadge key={genre}>{genre}</MetaBadge>
                            ))}
                          </div>
                        )}
                        <p className="text-sm font-semibold text-[var(--muted)] leading-relaxed line-clamp-3">
                          {tmdbPreviewData.overview || 'No overview available.'}
                        </p>
                      </div>
                    </div>
                  </ChunkyCard>

                  {tmdbType === 'tv' && tmdbPreviewData.seasons && tmdbPreviewData.seasons.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                          Season Breakdown
                        </span>
                        <span className="text-sm font-bold text-[var(--muted)]">
                          {tmdbPreviewData.totalSeasons ?? tmdbPreviewData.seasons.length} Seasons • {tmdbPreviewData.totalEpisodes ?? 0} Episodes
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {tmdbPreviewData.seasons.map((season) => (
                          <ChunkyCard
                            key={season.seasonNumber}
                            className="flex items-center justify-between p-2 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-sans text-[13px] font-extrabold text-[var(--muted)]">
                                S{season.seasonNumber}
                              </span>
                              <span className="font-bold text-[var(--ink)]">{season.name}</span>
                            </div>
                            <MetaBadge>
                              {season.episodeCount} {season.episodeCount === 1 ? 'ep' : 'eps'}
                            </MetaBadge>
                          </ChunkyCard>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {importTmdbMutation.error && (
                <ErrorBanner
                  message={
                    importTmdbMutation.error instanceof Error
                      ? importTmdbMutation.error.message
                      : 'Failed to import TMDB series'
                  }
                />
              )}
            </div>
          )}
        </ChunkyDrawerBody>

        <ChunkyDrawerFooter className="justify-between sm:justify-between">
          {step === 1 ? (
            <>
              <ChunkyButton
                type="button"
                variant="outline"
                onClick={closeDialog}
              >
                Cancel
              </ChunkyButton>
              <ChunkyButton
                type="button"
                variant="primary"
                onClick={() => void submitPreview()}
                disabled={isLoading || !tmdbId.trim()}
              >
                {isLoading && <Spinner />}
                {isLoading ? 'Fetching preview...' : 'Next'}
              </ChunkyButton>
            </>
          ) : (
            <>
              <ChunkyButton
                type="button"
                variant="outline"
                onClick={backToStep1}
                disabled={importTmdbMutation.isPending}
              >
                ← Back to Edit
              </ChunkyButton>
              <ChunkyButton
                type="button"
                variant="primary"
                onClick={() => {
                  importTmdbMutation.mutate({
                    type: tmdbType,
                    tmdbId: parseInt(tmdbId.trim(), 10),
                    includeSpecials,
                  });
                }}
                disabled={importTmdbMutation.isPending || !tmdbPreviewData}
              >
                {importTmdbMutation.isPending && <Spinner />}
                {importTmdbMutation.isPending ? 'Importing...' : 'Import Series'}
              </ChunkyButton>
            </>
          )}
        </ChunkyDrawerFooter>
      </ChunkyDrawerContent>
    </ChunkyDrawer>
  );
}
