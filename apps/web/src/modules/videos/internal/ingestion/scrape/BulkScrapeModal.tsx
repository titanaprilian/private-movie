import { useEffect } from 'react';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import { ChunkyButton } from '@/components/ui/chunky-button';
import type { BulkScrapeModalProps } from '../types';

export type { BulkScrapeModalProps, SeasonGroupOption } from '../types';
import { useBulkScrapeModal } from './hooks/useBulkScrapeModal';
import { BulkScrapeStepSource } from './components/BulkScrapeStepSource';
import { BulkScrapeStepReview } from './components/BulkScrapeStepReview';
import { BulkScrapeStepProgress } from './components/BulkScrapeStepProgress';
import { BulkScrapeOverwriteDialog } from './components/BulkScrapeOverwriteDialog';

const STEP_DESCRIPTIONS = {
  1: 'Enter season source URL to match scraped episodes with local TMDB episodes in the selected season.',
  2: 'Review matched scraped episodes, assign target local episodes, or ignore items before saving.',
  3: 'Sequential batch processing progress and status log.',
} as const;

export function BulkScrapeModal(props: BulkScrapeModalProps) {
  const { open, onOpenChange, seriesId, localEpisodes = [], seasons = [], onSuccess } = props;
  const modal = useBulkScrapeModal({ seriesId, seasons, localEpisodes, onSuccess });
  const { step, setStep, isProcessing, isFetchingPreview, isSaving, resetOnClose } = modal;

  useEffect(() => { resetOnClose(open); }, [open, resetOnClose]);

  const handleOpenChange = (openState: boolean) => {
    if (isProcessing) return;
    onOpenChange(openState);
  };

  return (
    <>
      <ChunkyDialog open={open} onOpenChange={handleOpenChange}>
        <ChunkyDialogContent className="max-w-3xl"
          onPointerDownOutside={(e) => { if (isProcessing) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (isProcessing) e.preventDefault(); }}>
          <ChunkyDialogHeader>
            <ChunkyDialogTitle>Bulk Add Sources</ChunkyDialogTitle>
            <ChunkyDialogDescription>{STEP_DESCRIPTIONS[step]}</ChunkyDialogDescription>
          </ChunkyDialogHeader>
          {step === 1 && (
            <form onSubmit={modal.handlePreviewSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <ChunkyDialogBody><BulkScrapeStepSource
                sourceUrl={modal.sourceUrl} sourceType={modal.sourceType}
                seasonOptions={modal.seasonOptions} selectedSeasonId={modal.selectedSeasonId}
                isFetchingPreview={isFetchingPreview} onSourceUrlChange={modal.setSourceUrl}
                onSourceTypeChange={modal.setSourceType} onSelectSeason={modal.selectSeason} />
              </ChunkyDialogBody>
              <ChunkyDialogFooter>
                <ChunkyButton type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isFetchingPreview}>Cancel</ChunkyButton>
                <ChunkyButton type="submit" variant="primary" disabled={isFetchingPreview}>{isFetchingPreview ? 'Fetching Preview...' : 'Preview'}</ChunkyButton>
              </ChunkyDialogFooter>
            </form>
          )}
          {step === 2 && (
            <>
              <ChunkyDialogBody><BulkScrapeStepReview
                previewItems={modal.previewItems} targetSeasonEpisodes={modal.targetSeasonEpisodes}
                seasons={seasons} localEpisodes={localEpisodes} selectedSeasonId={modal.selectedSeasonId}
                isSaving={isSaving} isEpisodeHasSources={modal.isEpisodeHasSources}
                onUpdateMapping={modal.updateMapping} onToggleIgnore={modal.toggleIgnore}
                onAutoAlign={modal.handleAutoAlign} />
              </ChunkyDialogBody>
              <ChunkyDialogFooter>
                <ChunkyButton type="button" variant="outline" onClick={() => setStep(1)} disabled={isSaving}>Back</ChunkyButton>
                <ChunkyButton type="button" variant="primary" onClick={modal.handleSaveClick} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</ChunkyButton>
              </ChunkyDialogFooter>
            </>
          )}
          {step === 3 && (
            <>
              <ChunkyDialogBody><BulkScrapeStepProgress
                completedCount={modal.completedCount} totalCount={modal.totalCount}
                progress={modal.progress} processingLogs={modal.processingLogs} />
              </ChunkyDialogBody>
              <ChunkyDialogFooter>
                {isProcessing ? (<ChunkyButton type="button" variant="outline" disabled>Processing...</ChunkyButton>)
                : (<ChunkyButton type="button" variant="primary" data-testid="bulk-scrape-close-btn" onClick={() => { onOpenChange(false); modal.reset(); }}>Close</ChunkyButton>)}
              </ChunkyDialogFooter>
            </>
          )}
        </ChunkyDialogContent>
      </ChunkyDialog>
      <BulkScrapeOverwriteDialog open={modal.showOverwriteConfirm} onOpenChange={modal.setShowOverwriteConfirm} onConfirm={modal.handleSaveConfirm} />
    </>
  );
}
