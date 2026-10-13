import { Loader2 } from 'lucide-react';
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
import { AddMediaStepInput } from './components/AddMediaStepInput';
import { AddMediaStepPreview } from './components/AddMediaStepPreview';
import { useAddMediaDialog } from './hooks/useAddMediaDialog';

export function AddMediaDialog() {
  const {
    isOpen,
    step,
    tmdbType,
    tmdbId,
    includeSpecials,
    tmdbPreviewData,
    isLoading,
    error,
    setTmdbType,
    setTmdbId,
    setIncludeSpecials,
    submitPreview,
    backToStep1,
    closeDialog,
    importTmdbMutation,
  } = useAddMediaDialog();

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
