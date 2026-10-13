import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { storageProvidersQueryOptions } from '@/modules/storage';
import { parseIngestUrl, type VideoSource } from '../../api';
import type {
  ManageSourcesTab,
  RemotePrefillState,
  UseManageSourcesDialogOptions,
  UseManageSourcesDialogReturn,
} from '../types';

export function useManageSourcesDialog({
  open,
  initialTab,
}: UseManageSourcesDialogOptions): UseManageSourcesDialogReturn {
  const [activeTab, setActiveTab] = useState<ManageSourcesTab>('add-url');

  const { data: rawProviders } = useQuery(storageProvidersQueryOptions());
  const providers = Array.isArray(rawProviders) ? rawProviders : [];
  const defaultProvider =
    providers.find((p) => p.isDefault) || providers[0] || null;

  const [remotePrefill, setRemotePrefill] = useState<RemotePrefillState>({
    url: '',
    label: '',
    quality: '',
  });

  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  const handleIngestShortcut = (source: VideoSource) => {
    const parsed = parseIngestUrl(source.url);
    setRemotePrefill({
      url: source.url,
      label: source.quality ? `S3 ${source.quality}` : parsed.label,
      quality: source.quality || parsed.quality || '',
    });
    setActiveTab('remote-ingest');
  };

  return {
    activeTab,
    setActiveTab,
    providers,
    defaultProvider,
    remotePrefill,
    handleIngestShortcut,
  };
}
