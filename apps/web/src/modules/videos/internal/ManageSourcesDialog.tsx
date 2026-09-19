import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  type SeriesDetails,
  type VideoSource,
  parseIngestUrl,
} from './api';
import { storageProvidersQueryOptions } from '@/modules/storage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DirectUrlTab,
  ScraperPreviewTab,
  S3UploadTab,
  RemoteIngestTab,
  EditExistingSourcesTab,
} from './sources';

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Sources</DialogTitle>
          <DialogDescription>
            Add or edit video streaming sources for this episode.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) =>
            setActiveTab(
              val as 'add-url' | 'add-direct' | 'remote-ingest' | 'upload-s3' | 'edit-existing'
            )
          }
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-5 text-[11px]">
            <TabsTrigger value="add-url" className="px-1 text-[11px]">
              Add from URL
            </TabsTrigger>
            <TabsTrigger value="add-direct" className="px-1 text-[11px]">
              Add Direct
            </TabsTrigger>
            <TabsTrigger value="remote-ingest" className="px-1 text-[11px]">
              Remote Ingest
            </TabsTrigger>
            <TabsTrigger value="upload-s3" className="px-1 text-[11px]">
              Upload Video
            </TabsTrigger>
            <TabsTrigger value="edit-existing" className="px-1 text-[11px]">
              Edit Existing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add-url" className="mt-4 space-y-3">
            <ScraperPreviewTab
              episodeId={episode.id}
              seriesId={seriesId}
              onSuccess={() => setActiveTab('edit-existing')}
            />
          </TabsContent>

          <TabsContent value="add-direct" className="mt-4 space-y-3">
            <DirectUrlTab
              episodeId={episode.id}
              seriesId={seriesId}
              onSuccess={() => setActiveTab('edit-existing')}
            />
          </TabsContent>

          <TabsContent value="remote-ingest" className="mt-4 space-y-3">
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
          </TabsContent>

          <TabsContent value="upload-s3" className="mt-4 space-y-3">
            <S3UploadTab
              episodeId={episode.id}
              seriesId={seriesId}
              providers={providers}
              defaultProvider={defaultProvider}
              onSuccess={() => setActiveTab('edit-existing')}
            />
          </TabsContent>

          <TabsContent value="edit-existing" className="mt-4 space-y-3">
            <EditExistingSourcesTab
              episode={episode}
              seriesId={seriesId}
              providers={providers}
              onIngestShortcut={handleIngestShortcut}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
