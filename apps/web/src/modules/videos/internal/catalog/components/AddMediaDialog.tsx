import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useScrapeWorkerStore } from '../../store/useScrapeWorkerStore';
import { importTmdb, type ImportTmdbParams } from '../../api';
import {
  ChunkyDrawer,
  ChunkyDrawerBody,
  ChunkyDrawerContent,
  ChunkyDrawerDescription,
  ChunkyDrawerFooter,
  ChunkyDrawerHeader,
  ChunkyDrawerTitle,
} from '@/components/ui/chunky-drawer';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { AddMediaStepInput } from './AddMediaStepInput';
import { AddMediaStepPreview } from './AddMediaStepPreview';

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
            <AddMediaStepInput
              tmdbType={tmdbType}
              tmdbId={tmdbId}
              includeSpecials={includeSpecials}
              error={error}
              onTmdbTypeChange={setTmdbType}
              onTmdbIdChange={setTmdbId}
              onIncludeSpecialsChange={setIncludeSpecials}
            />
          ) : (
            <AddMediaStepPreview
              tmdbType={tmdbType}
              tmdbId={tmdbId}
              previewData={tmdbPreviewData}
              importError={importTmdbMutation.error}
            />
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
                {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
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
                {importTmdbMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {importTmdbMutation.isPending ? 'Importing...' : 'Import Series'}
              </ChunkyButton>
            </>
          )}
        </ChunkyDrawerFooter>
      </ChunkyDrawerContent>
    </ChunkyDrawer>
  );
}
