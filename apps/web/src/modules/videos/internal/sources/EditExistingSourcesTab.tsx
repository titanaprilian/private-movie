import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type StorageProviderItem } from '@/modules/storage';
import {
  type VideoSource,
  type SeriesDetails,
  updateVideoSource,
  deleteVideoSource,
} from '../api';

type Episode = SeriesDetails['episodes'][number];

export interface EditSourceRowProps {
  source: VideoSource;
  providers?: StorageProviderItem[];
  onUpdate: (updates: {
    type: 'direct' | 'embed' | 's3';
    label: string;
    url: string;
    quality?: string | null;
    storageProviderId?: string | null;
  }) => void;
  onDelete: () => void;
  onIngestToS3?: () => void;
  isPending: boolean;
}

export function EditSourceRow({
  source,
  providers,
  onUpdate,
  onDelete,
  onIngestToS3,
  isPending,
}: EditSourceRowProps) {
  const [label, setLabel] = useState(source.label);
  const [url, setUrl] = useState(source.url);
  const [type, setType] = useState<'direct' | 'embed' | 's3'>(source.type);
  const [quality, setQuality] = useState(source.quality ?? '');
  const [storageProviderId, setStorageProviderId] = useState<string | null | undefined>(
    source.storageProviderId
  );

  useEffect(() => {
    setLabel(source.label);
    setUrl(source.url);
    setType(source.type);
    setQuality(source.quality ?? '');
    setStorageProviderId(source.storageProviderId);
  }, [source]);

  const linkedProvider = providers?.find((p) => p.id === source.storageProviderId);
  const providerBadgeText = linkedProvider ? `S3: ${linkedProvider.name}` : source.type;

  return (
    <div
      className="p-3 border border-c rounded bg-card space-y-2 text-xs"
      data-testid={`source-row-${source.id}`}
    >
      <div className="flex items-center justify-between">
        <span
          data-testid={`source-type-badge-${source.id}`}
          className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-medium ${
            source.type === 's3'
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-800'
              : source.type === 'direct'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-800'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-800'
          }`}
        >
          {providerBadgeText}
        </span>
      </div>
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
          <Select
            value={type}
            onValueChange={(val) => setType(val as 'direct' | 'embed' | 's3')}
          >
            <SelectTrigger className="w-full h-8 px-2 text-xs mono">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="embed">Embed</SelectItem>
              <SelectItem value="s3">S3 Storage</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted">URL / S3 Key</Label>
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
      {type === 's3' && providers && providers.length > 0 && (
        <div>
          <Label className="text-[10px] text-muted">S3 Storage Provider</Label>
          <Select
            value={storageProviderId || 'default'}
            onValueChange={(val) => setStorageProviderId(val === 'default' ? null : val)}
          >
            <SelectTrigger className="w-full h-8 px-2 text-xs mono">
              <SelectValue placeholder="Default Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default Provider</SelectItem>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} {p.isDefault ? '(Default)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
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
        <div className="flex items-center gap-2">
          {source.type === 'direct' && onIngestToS3 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs h-7 border-purple-200 dark:border-purple-900/50 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
              disabled={isPending}
              onClick={onIngestToS3}
            >
              Ingest to S3
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="text-xs h-7"
            disabled={isPending}
            onClick={() => {
              const updates: {
                type: 'direct' | 'embed' | 's3';
                label: string;
                url: string;
                quality?: string | null;
                storageProviderId?: string | null;
              } = {
                type,
                label,
                url,
                quality: quality || null,
              };
              if (storageProviderId !== undefined) {
                updates.storageProviderId = storageProviderId;
              }
              onUpdate(updates);
            }}
          >
            Update Source
          </Button>
        </div>
      </div>
    </div>
  );
}

export interface EditExistingSourcesTabProps {
  episode: Episode;
  seriesId: string;
  providers: StorageProviderItem[];
  onIngestShortcut: (source: VideoSource) => void;
}

export function EditExistingSourcesTab({
  episode,
  seriesId,
  providers,
  onIngestShortcut,
}: EditExistingSourcesTabProps) {
  const queryClient = useQueryClient();

  const updateSourceMutation = useMutation({
    mutationFn: ({
      episodeId,
      sourceId,
      updates,
    }: {
      episodeId: string;
      sourceId: string;
      updates: Parameters<typeof updateVideoSource>[2];
    }) => updateVideoSource(episodeId, sourceId, updates),
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

  if (!episode.videoSources || episode.videoSources.length === 0) {
    return (
      <div className="text-xs text-muted mono italic py-4 text-center border border-c rounded">
        No video sources configured.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
      {episode.videoSources.map((source) => (
        <EditSourceRow
          key={source.id}
          source={source}
          providers={providers}
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
          onIngestToS3={() => onIngestShortcut(source)}
          isPending={updateSourceMutation.isPending || deleteSourceMutation.isPending}
        />
      ))}
    </div>
  );
}
