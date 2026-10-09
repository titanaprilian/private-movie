import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyInput } from '@/components/ui/chunky-input';
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
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
          <span className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
            Label
          </span>
          <ChunkyInput
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-label="Label"
          />
        </div>
        <div>
          <span className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
            Type
          </span>
          <ChunkySelect
            value={type}
            onValueChange={(val) => setType(val as 'direct' | 'embed' | 's3')}
          >
            <ChunkySelectTrigger aria-label="Type">
              <ChunkySelectValue placeholder="Select type" />
            </ChunkySelectTrigger>
            <ChunkySelectContent>
              <ChunkySelectItem value="direct">Direct</ChunkySelectItem>
              <ChunkySelectItem value="embed">Embed</ChunkySelectItem>
              <ChunkySelectItem value="s3">S3 Storage</ChunkySelectItem>
            </ChunkySelectContent>
          </ChunkySelect>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
            URL / S3 Key
          </span>
          <ChunkyInput
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="URL / S3 Key"
          />
        </div>
        <div>
          <span className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
            Quality
          </span>
          <ChunkyInput
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            placeholder="e.g. 720p"
            aria-label="Quality"
          />
        </div>
      </div>
      {type === 's3' && providers && providers.length > 0 && (
        <div>
          <span className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
            S3 Storage Provider
          </span>
          <ChunkySelect
            value={storageProviderId || 'default'}
            onValueChange={(val) => setStorageProviderId(val === 'default' ? null : val)}
          >
            <ChunkySelectTrigger aria-label="S3 Storage Provider">
              <ChunkySelectValue placeholder="Default Provider" />
            </ChunkySelectTrigger>
            <ChunkySelectContent>
              <ChunkySelectItem value="default">Default Provider</ChunkySelectItem>
              {providers.map((p) => (
                <ChunkySelectItem key={p.id} value={p.id}>
                  {p.name} {p.isDefault ? '(Default)' : ''}
                </ChunkySelectItem>
              ))}
            </ChunkySelectContent>
          </ChunkySelect>
        </div>
      )}
      <div className="flex items-center justify-between pt-1 gap-2">
        <ChunkyButton
          type="button"
          size="sm"
          variant="danger"
          disabled={isPending}
          onClick={onDelete}
        >
          Remove Source
        </ChunkyButton>
        <div className="flex items-center gap-2">
          {source.type === 'direct' && onIngestToS3 && (
            <ChunkyButton
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={onIngestToS3}
            >
              Ingest to S3
            </ChunkyButton>
          )}
          <ChunkyButton
            type="button"
            size="sm"
            variant="primary"
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
          </ChunkyButton>
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
