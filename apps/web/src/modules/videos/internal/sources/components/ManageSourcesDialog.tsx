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
import { useManageSourcesDialog } from '../hooks/useManageSourcesDialog';
import type {
  ManageSourcesDialogProps,
  ManageSourcesTab,
} from '../types';
import {
  DirectUrlTab,
  ScraperPreviewTab,
  S3UploadTab,
  RemoteIngestTab,
  EditExistingSourcesTab,
} from './tabs';

export type { ManageSourcesDialogProps } from '../types';

export function ManageSourcesDialog({
  open,
  onOpenChange,
  episode,
  seriesId,
  initialTab,
}: ManageSourcesDialogProps) {
  const {
    activeTab,
    setActiveTab,
    providers,
    defaultProvider,
    remotePrefill,
    handleIngestShortcut,
  } = useManageSourcesDialog({ open, initialTab });

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
          onValueChange={(val) => setActiveTab(val as ManageSourcesTab)}
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
