import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  type SeriesDetails,
  type VideoSource,
  parseIngestUrl,
} from '../api';
import { storageProvidersQueryOptions } from '@/modules/storage';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
  ChunkyDialogBody,
} from '@/components/ui/chunky-dialog';
import {
  ChunkyTabs,
  ChunkyTabsList,
  ChunkyTabsTrigger,
  ChunkyTabsContent,
} from '@/components/ui/chunky-tabs';
import {
  DirectUrlTab,
  ScraperPreviewTab,
  S3UploadTab,
  RemoteIngestTab,
  EditExistingSourcesTab,
} from './index';

type Episode = SeriesDetails['episodes'][number];

interface ManageSourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episode: Episode | null;
  seriesId: string;
  initialTab?: 'add-url' | 'add-direct' | 'remote-ingest' | 'upload-s3' | 'edit-existing';
}

export function ManageSourcesDialog({
  open,
  onOpenChange,
  episode,
  seriesId,
  initialTab,
}: ManageSourcesDialogProps) {
  const [activeTab, setActiveTab] = useState<
    'add-url' | 'add-direct' | 'remote-ingest' | 'upload-s3' | 'edit-existing'
  >('add-url');

  // Storage Providers Query
  const { data: rawProviders } = useQuery(storageProvidersQueryOptions());
  const providers = Array.isArray(rawProviders) ? rawProviders : [];
  const defaultProvider = providers.find((p) => p.isDefault) || providers[0] || null;

  // Shortcut prefill state for remote ingest
  const [remotePrefill, setRemotePrefill] = useState<{
    url: string;
    label: string;
    quality: string;
  }>({ url: '', label: '', quality: '' });

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

  if (!episode) return null;

  return (
    <ChunkyDialog open={open} onOpenChange={onOpenChange}>
      <ChunkyDialogContent className="max-w-2xl">
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>Manage Sources</ChunkyDialogTitle>
          <ChunkyDialogDescription>
            Add or edit video streaming sources for this episode.
          </ChunkyDialogDescription>
        </ChunkyDialogHeader>

        <ChunkyDialogBody>
        <ChunkyTabs
          value={activeTab}
          onValueChange={(val) =>
            setActiveTab(
              val as 'add-url' | 'add-direct' | 'remote-ingest' | 'upload-s3' | 'edit-existing'
            )
          }
          className="w-full"
        >
          <ChunkyTabsList className="flex w-full flex-wrap gap-2">
            <ChunkyTabsTrigger value="add-url" className="flex-1 px-2 text-[11px]">
              Add from URL
            </ChunkyTabsTrigger>
            <ChunkyTabsTrigger value="add-direct" className="flex-1 px-2 text-[11px]">
              Add Direct
            </ChunkyTabsTrigger>
            <ChunkyTabsTrigger value="remote-ingest" className="flex-1 px-2 text-[11px]">
              Remote Ingest
            </ChunkyTabsTrigger>
            <ChunkyTabsTrigger value="upload-s3" className="flex-1 px-2 text-[11px]">
              Upload Video
            </ChunkyTabsTrigger>
            <ChunkyTabsTrigger value="edit-existing" className="flex-1 px-2 text-[11px]">
              Edit Existing
            </ChunkyTabsTrigger>
          </ChunkyTabsList>

          <ChunkyTabsContent value="add-url" className="mt-4 space-y-3">
            <ScraperPreviewTab
              episodeId={episode.id}
              seriesId={seriesId}
              onSuccess={() => setActiveTab('edit-existing')}
            />
          </ChunkyTabsContent>

          <ChunkyTabsContent value="add-direct" className="mt-4 space-y-3">
            <DirectUrlTab
              episodeId={episode.id}
              seriesId={seriesId}
              onSuccess={() => setActiveTab('edit-existing')}
            />
          </ChunkyTabsContent>

          <ChunkyTabsContent value="remote-ingest" className="mt-4 space-y-3">
            <RemoteIngestTab
              episodeId={episode.id}
              seriesId={seriesId}
              providers={providers}
              defaultProvider={defaultProvider}
              initialUrl={remotePrefill.url}
              initialLabel={remotePrefill.label}
              initialQuality={remotePrefill.quality}
              onSuccess={() => setActiveTab('edit-existing')}
            />
          </ChunkyTabsContent>

          <ChunkyTabsContent value="upload-s3" className="mt-4 space-y-3">
            <S3UploadTab
              episodeId={episode.id}
              seriesId={seriesId}
              providers={providers}
              defaultProvider={defaultProvider}
              onSuccess={() => setActiveTab('edit-existing')}
            />
          </ChunkyTabsContent>

          <ChunkyTabsContent value="edit-existing" className="mt-4 space-y-3">
            <EditExistingSourcesTab
              episode={episode}
              seriesId={seriesId}
              providers={providers}
              onIngestShortcut={handleIngestShortcut}
            />
          </ChunkyTabsContent>
        </ChunkyTabs>
        </ChunkyDialogBody>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
