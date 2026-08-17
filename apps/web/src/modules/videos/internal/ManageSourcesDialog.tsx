import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  type SeriesDetails,
  addVideoSources,
  updateVideoSource,
  deleteVideoSource,
  type VideoSource,
} from './api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

type Episode = SeriesDetails['episodes'][number];

interface ManageSourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episode: Episode | null;
  seriesId: string;
}

function EditSourceRow({
  source,
  onUpdate,
  onDelete,
  isPending,
}: {
  source: VideoSource;
  onUpdate: (updates: { type: 'direct' | 'embed'; label: string; url: string; quality?: string | null }) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [label, setLabel] = useState(source.label);
  const [url, setUrl] = useState(source.url);
  const [type, setType] = useState<'direct' | 'embed'>(source.type);
  const [quality, setQuality] = useState(source.quality ?? '');

  useEffect(() => {
    setLabel(source.label);
    setUrl(source.url);
    setType(source.type);
    setQuality(source.quality ?? '');
  }, [source]);

  return (
    <div className="p-3 border border-c rounded bg-card space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted">Label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="text-xs h-8"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted">Type</Label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'direct' | 'embed')}
            className="w-full h-8 px-2 rounded border border-c bg-card text-xs mono focus:outline-none focus:border-primary"
          >
            <option value="direct">Direct</option>
            <option value="embed">Embed</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted">URL</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="text-xs h-8"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted">Quality</Label>
          <Input
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            placeholder="e.g. 720p"
            className="text-xs h-8"
          />
        </div>
      </div>
      <div className="flex items-center justify-between pt-1 gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-xs h-7 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
          disabled={isPending}
          onClick={onDelete}
        >
          Remove Source
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="text-xs h-7"
          disabled={isPending}
          onClick={() =>
            onUpdate({
              type,
              label,
              url,
              quality: quality || null,
            })
          }
        >
          Update Source
        </Button>
      </div>
    </div>
  );
}

export function ManageSourcesDialog({
  open,
  onOpenChange,
  episode,
  seriesId,
}: ManageSourcesDialogProps) {
  const queryClient = useQueryClient();

  const [newSourceLabel, setNewSourceLabel] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState<'direct' | 'embed'>('direct');
  const [newSourceQuality, setNewSourceQuality] = useState('');

  const addSourceMutation = useMutation({
    mutationFn: ({ episodeId, source }: { episodeId: string; source: Parameters<typeof addVideoSources>[1] }) =>
      addVideoSources(episodeId, source),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      toast.success('video.source_add', {
        description: 'Successfully added video source',
      });
      setNewSourceLabel('');
      setNewSourceUrl('');
      setNewSourceQuality('');
      setNewSourceType('direct');
    },
    onError: (error) => {
      toast.error('video.source_add', {
        description: `Failed to add source: ${error.message}`,
      });
    },
  });

  const updateSourceMutation = useMutation({
    mutationFn: ({ episodeId, sourceId, updates }: { episodeId: string; sourceId: string; updates: Parameters<typeof updateVideoSource>[2] }) =>
      updateVideoSource(episodeId, sourceId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      toast.success('video.source_update', {
        description: 'Successfully updated video source',
      });
    },
    onError: (error) => {
      toast.error('video.source_update', {
        description: `Failed to update source: ${error.message}`,
      });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: ({ episodeId, sourceId }: { episodeId: string; sourceId: string }) =>
      deleteVideoSource(episodeId, sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      toast.success('video.source_delete', {
        description: 'Successfully removed video source',
      });
    },
    onError: (error) => {
      toast.error('video.source_delete', {
        description: `Failed to remove source: ${error.message}`,
      });
    },
  });

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

        <Tabs defaultValue="add-url" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add-url">Add from URL</TabsTrigger>
            <TabsTrigger value="edit-existing">Edit Existing</TabsTrigger>
          </TabsList>

          <TabsContent value="add-url" className="mt-4 space-y-3">
            <div className="p-3 border border-c rounded bg-sidebar space-y-2">
              <div className="text-xs font-medium mono text-muted uppercase">Add Video Source</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="manage-new-source-label" className="text-[10px] text-muted">Label</Label>
                  <Input
                    id="manage-new-source-label"
                    placeholder="New source label"
                    value={newSourceLabel}
                    onChange={(e) => setNewSourceLabel(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="manage-new-source-type" className="text-[10px] text-muted">Type</Label>
                  <select
                    id="manage-new-source-type"
                    value={newSourceType}
                    onChange={(e) => setNewSourceType(e.target.value as 'direct' | 'embed')}
                    className="w-full h-8 px-2 rounded border border-c bg-card text-xs mono focus:outline-none focus:border-primary"
                  >
                    <option value="direct">Direct</option>
                    <option value="embed">Embed</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="manage-new-source-url" className="text-[10px] text-muted">URL</Label>
                  <Input
                    id="manage-new-source-url"
                    placeholder="New source URL"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="manage-new-source-quality" className="text-[10px] text-muted">Quality</Label>
                  <Input
                    id="manage-new-source-quality"
                    placeholder="Quality (e.g. 720p)"
                    value={newSourceQuality}
                    onChange={(e) => setNewSourceQuality(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full text-xs h-8 mt-1"
                disabled={addSourceMutation.isPending || !newSourceLabel.trim() || !newSourceUrl.trim()}
                onClick={() => {
                  addSourceMutation.mutate({
                    episodeId: episode.id,
                    source: {
                      type: newSourceType,
                      label: newSourceLabel,
                      url: newSourceUrl,
                      quality: newSourceQuality || null,
                    },
                  });
                }}
              >
                Add Source
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="edit-existing" className="mt-4 space-y-3">
            {episode.videoSources && episode.videoSources.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {episode.videoSources.map((source) => (
                  <EditSourceRow
                    key={source.id}
                    source={source}
                    onUpdate={(updates) => {
                      updateSourceMutation.mutate({
                        episodeId: episode.id,
                        sourceId: source.id,
                        updates,
                      });
                    }}
                    onDelete={() => {
                      deleteSourceMutation.mutate({
                        episodeId: episode.id,
                        sourceId: source.id,
                      });
                    }}
                    isPending={updateSourceMutation.isPending || deleteSourceMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted mono italic py-4 text-center border border-c rounded">
                No video sources configured.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
