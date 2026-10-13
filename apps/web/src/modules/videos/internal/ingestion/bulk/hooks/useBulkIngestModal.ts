import { useCallback, useState } from 'react';
import { useArchiveIngestSources } from './useArchiveIngestSources';
import { useBulkIngestSources } from './useBulkIngestSources';
import type {
  LocalEpisodeItem,
  SeasonGroupOption,
} from '../../types';

export type IngestTab = 'archive' | 'url';

export interface UseBulkIngestModalOptions {
  seriesId: string;
  seasons?: SeasonGroupOption[];
  localEpisodes?: LocalEpisodeItem[];
  onSuccess?: () => void;
}

const STEP_DESCRIPTIONS = {
  archive1: 'Enter a ZIP or RAR archive URL to preview, review, and ingest episode files.',
  url1: 'Paste multi-line video stream URLs for season ingestion to Backblaze B2/S3 storage.',
  review: 'Review matched episodes, manually assign unmatched files, and adjust labels/qualities.',
  progress: 'Sequential ingestion progress and transfer status log.',
} as const;

export function useBulkIngestModal({
  seriesId,
  seasons,
  localEpisodes = [],
  onSuccess,
}: UseBulkIngestModalOptions) {
  const url = useBulkIngestSources({ seriesId, seasons, localEpisodes, onSuccess });
  const archive = useArchiveIngestSources({ seriesId, seasons, localEpisodes, onSuccess });
  const [activeTab, setActiveTab] = useState<IngestTab>('archive');

  const isProcessingAny =
    url.isProcessing ||
    archive.isCommitting ||
    archive.isPolling ||
    archive.previewPhase === 'downloading' ||
    archive.previewPhase === 'extracting';

  const { reset: urlReset, parseUrls } = url;
  const { reset: archiveReset } = archive;

  const resetOnClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        urlReset();
        void archiveReset();
        setActiveTab('archive');
      }
    },
    [urlReset, archiveReset],
  );

  const effectiveStep = activeTab === 'archive' ? archive.step : url.step;

  const description =
    effectiveStep === 1
      ? activeTab === 'archive'
        ? STEP_DESCRIPTIONS.archive1
        : STEP_DESCRIPTIONS.url1
      : effectiveStep === 2
        ? STEP_DESCRIPTIONS.review
        : STEP_DESCRIPTIONS.progress;

  const handleUrlStep1Submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      parseUrls();
    },
    [parseUrls],
  );

  const urlSelectedProviderName =
    url.storageProviders.find((p) => p.id === url.selectedStorageProviderId)?.name ?? null;

  return {
    url,
    archive,
    activeTab,
    setActiveTab,
    isProcessingAny,
    effectiveStep,
    description,
    handleUrlStep1Submit,
    resetOnClose,
    urlSelectedProviderName,
  };
}

export type UseBulkIngestModalReturn = ReturnType<typeof useBulkIngestModal>;
