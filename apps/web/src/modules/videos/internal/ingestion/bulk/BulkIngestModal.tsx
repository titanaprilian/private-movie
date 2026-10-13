import { useEffect } from 'react';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
} from '@/components/ui/chunky-dialog';
import type { BulkIngestModalProps } from '../types';

export type { BulkIngestModalProps } from '../types';
import { useBulkIngestModal } from './hooks/useBulkIngestModal';
import {
  ArchiveStep1,
  ArchiveStep2,
  ArchiveStep3,
  UrlStep1,
  UrlStep2,
  UrlStep3,
  BulkIngestTabs,
} from './components';

export function BulkIngestModal(props: BulkIngestModalProps) {
  const { open, onOpenChange, seriesId, localEpisodes = [], seasons = [], onSuccess } = props;
  const modal = useBulkIngestModal({ seriesId, seasons, localEpisodes, onSuccess });
  const { url, archive, activeTab, setActiveTab, isProcessingAny, resetOnClose } = modal;

  useEffect(() => { resetOnClose(open); }, [open, resetOnClose]);

  const handleOpenChange = (openState: boolean) => {
    if (isProcessingAny) return;
    onOpenChange(openState);
  };

  return (
    <ChunkyDialog open={open} onOpenChange={handleOpenChange}>
      <ChunkyDialogContent
        className="max-w-3xl"
        onPointerDownOutside={(e) => { if (isProcessingAny) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (isProcessingAny) e.preventDefault(); }}
      >
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>Bulk Ingest Sources</ChunkyDialogTitle>
          <ChunkyDialogDescription>{modal.description}</ChunkyDialogDescription>
        </ChunkyDialogHeader>

        {activeTab === 'archive' && archive.step === 1 && (
          <>
            <BulkIngestTabs activeTab={activeTab} onTabChange={setActiveTab} />
            <ArchiveStep1
              archiveUrl={archive.archiveUrl} setArchiveUrl={archive.setArchiveUrl}
              archivePassword={archive.archivePassword} setArchivePassword={archive.setArchivePassword}
              archiveReferer={archive.archiveReferer} setArchiveReferer={archive.setArchiveReferer}
              defaultLabel={archive.defaultLabel} setDefaultLabel={archive.setDefaultLabel}
              selectedSeasonId={archive.selectedSeasonId} setSelectedSeasonId={archive.setSelectedSeasonId}
              seasonOptions={archive.seasonOptions} storageProviders={archive.storageProviders}
              selectedStorageProviderId={archive.selectedStorageProviderId}
              setSelectedStorageProviderId={archive.setSelectedStorageProviderId}
              previewPhase={archive.previewPhase} previewError={archive.previewError}
              downloadProgress={archive.downloadProgress} extractProgress={archive.extractProgress}
              needsPassword={archive.needsPassword} jobErrorCode={archive.jobErrorCode}
              isSubmitting={archive.isSubmitting}
              onStartPreview={() => void archive.startJob()}
              onCancel={() => onOpenChange(false)}
              onCancelJob={() => void archive.cancelJob()}
              onRetry={() => void archive.retryWithPassword()}
            />
          </>
        )}

        {activeTab === 'archive' && archive.step === 2 && (
          <ArchiveStep2
            reviewItems={archive.reviewItems} totalCount={archive.totalCount}
            matchedCount={archive.matchedCount} needsReviewCount={archive.needsReviewCount}
            selectedProviderName={archive.selectedProviderName}
            updateReviewMapping={archive.updateReviewMapping}
            updateReviewLabel={archive.updateReviewLabel}
            updateReviewQuality={archive.updateReviewQuality}
            toggleReviewIgnore={archive.toggleReviewIgnore}
            seasons={seasons} localEpisodes={localEpisodes}
            onBack={() => archive.setStep(1)}
            onCommit={() => void archive.confirmSelection()}
            onCancelJob={() => void archive.cancelJob()}
          />
        )}

        {activeTab === 'archive' && archive.step === 3 && (
          <ArchiveStep3
            reviewItems={archive.reviewItems} totalCount={archive.totalCount}
            commitCompletedCount={archive.commitCompletedCount}
            progressPercentage={archive.progressPercentage}
            activeCommitItem={archive.activeCommitItem} uploadView={archive.uploadView}
            selectedProviderName={archive.selectedProviderName}
            isCommitting={archive.isCommitting}
            onCancel={() => void archive.cancelJob()}
            onClose={() => { onOpenChange(false); archive.reset(); }}
          />
        )}

        {activeTab === 'url' && url.step === 1 && (
          <>
            <BulkIngestTabs activeTab={activeTab} onTabChange={setActiveTab} />
            <UrlStep1
              rawUrlsText={url.rawUrlsText} setRawUrlsText={url.setRawUrlsText}
              urlSelectedSeasonId={url.selectedSeasonId} setUrlSelectedSeasonId={url.setSelectedSeasonId}
              seasonOptions={url.seasonOptions} defaultQuality={url.defaultQuality}
              setDefaultQuality={url.setDefaultQuality} storageProviders={url.storageProviders}
              urlStorageProviderId={url.selectedStorageProviderId}
              setUrlStorageProviderId={url.setSelectedStorageProviderId}
              urlDefaultLabel={url.defaultLabel} setUrlDefaultLabel={url.setDefaultLabel}
              sharedReferer={url.sharedReferer} setSharedReferer={url.setSharedReferer}
              isProcessing={url.isProcessing}
              onSubmit={modal.handleUrlStep1Submit}
              onCancel={() => onOpenChange(false)}
            />
          </>
        )}

        {activeTab === 'url' && url.step === 2 && (
          <UrlStep2
            items={url.items} urlTotalCount={url.totalCount}
            urlMatchedCount={url.matchedCount} urlNeedsReviewCount={url.needsReviewCount}
            urlSelectedProviderName={modal.urlSelectedProviderName}
            updateMapping={url.updateMapping} updateLabel={url.updateLabel}
            updateQuality={url.updateQuality} toggleIgnore={url.toggleIgnore}
            seasons={seasons} localEpisodes={localEpisodes}
            onBack={() => url.setStep(1)}
            onStart={() => void url.startIngestQueue()}
          />
        )}

        {activeTab === 'url' && url.step === 3 && (
          <UrlStep3
            items={url.items} urlTotalCount={url.totalCount}
            urlProgressPercentage={url.progressPercentage} completedCount={url.completedCount}
            activeItem={url.activeItem} urlSelectedProviderName={modal.urlSelectedProviderName}
            isProcessing={url.isProcessing}
            onCancelQueue={url.cancelQueue}
            onClose={() => { onOpenChange(false); url.reset(); }}
          />
        )}
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
