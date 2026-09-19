import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { remoteIngestEpisodeVideoSource, parseIngestUrl } from '../api';

export interface RemoteIngestTabProps {
  episodeId: string;
  seriesId: string;
  providers: StorageProviderItem[];
  defaultProvider: StorageProviderItem | null;
  initialUrl?: string;
  initialLabel?: string;
  initialQuality?: string;
  onSuccess: () => void;
}

export function RemoteIngestTab({
  episodeId,
  seriesId,
  providers,
  defaultProvider,
  initialUrl = '',
  initialLabel = '',
  initialQuality = '',
  onSuccess,
}: RemoteIngestTabProps) {
  const queryClient = useQueryClient();
  const [remoteUrl, setRemoteUrl] = useState(initialUrl);
  const [remoteLabel, setRemoteLabel] = useState(initialLabel);
  const [remoteQuality, setRemoteQuality] = useState(initialQuality);
  const [remoteReferer, setRemoteReferer] = useState('');
  const [remoteProviderId, setRemoteProviderId] = useState<string>('');
  const [showAdvancedHeaders, setShowAdvancedHeaders] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState<'idle' | 'ingesting'>('idle');
  const [remoteProgress, setRemoteProgress] = useState({ percent: 0, loaded: 0, total: 0 });
  const [remoteS3Warning, setRemoteS3Warning] = useState<string | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const remoteAbortControllerRef = useRef<AbortController | null>(null);
  const isRemoteLabelManuallyEdited = useRef(false);

  const isIngesting = remoteStatus !== 'idle';

  useEffect(() => {
    if (defaultProvider) {
      setRemoteProviderId((prev) => prev || defaultProvider.id);
    }
  }, [defaultProvider]);

  useEffect(() => {
    if (initialUrl) {
      setRemoteUrl(initialUrl);
    }
    if (initialLabel) {
      setRemoteLabel(initialLabel);
      isRemoteLabelManuallyEdited.current = true;
    }
    if (initialQuality) {
      setRemoteQuality(initialQuality);
      isRemoteLabelManuallyEdited.current = true;
    }
  }, [initialUrl, initialLabel, initialQuality]);

  const handleRemoteUrlChange = (val: string) => {
    setRemoteUrl(val);
    if (!isRemoteLabelManuallyEdited.current) {
      const parsed = parseIngestUrl(val);
      setRemoteLabel(parsed.label);
      setRemoteQuality(parsed.quality || '');
    }
  };

  const cancelRemoteIngest = () => {
    if (remoteAbortControllerRef.current) {
      remoteAbortControllerRef.current.abort();
      remoteAbortControllerRef.current = null;
    }
    setRemoteStatus('idle');
    setRemoteProgress({ percent: 0, loaded: 0, total: 0 });
    setRemoteUrl('');
    setRemoteLabel('');
    setRemoteQuality('');
    setRemoteReferer('');
    setShowAdvancedHeaders(false);
    setRemoteError(null);
    isRemoteLabelManuallyEdited.current = false;
  };

  const handleRemoteIngest = async () => {
    if (!remoteUrl.trim() || !remoteLabel.trim()) return;

    setRemoteS3Warning(null);
    setRemoteError(null);
    const controller = new AbortController();
    remoteAbortControllerRef.current = controller;
    setRemoteStatus('ingesting');
    setRemoteProgress({ percent: 0, loaded: 0, total: 0 });

    try {
      await remoteIngestEpisodeVideoSource(episodeId, {
        url: remoteUrl.trim(),
        label: remoteLabel.trim(),
        quality: remoteQuality.trim() || undefined,
        referer: remoteReferer.trim() || undefined,
        storageProviderId: remoteProviderId || undefined,
        signal: controller.signal,
        onProgress: (progress) => {
          setRemoteProgress(progress);
        },
      });

      if (controller.signal.aborted) return;

      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      toast.success('video.remote_ingest', {
        description: 'Successfully ingested remote video to S3',
      });

      setRemoteStatus('idle');
      setRemoteProgress({ percent: 0, loaded: 0, total: 0 });
      setRemoteUrl('');
      setRemoteLabel('');
      setRemoteQuality('');
      setRemoteReferer('');
      setShowAdvancedHeaders(false);
      setRemoteError(null);
      remoteAbortControllerRef.current = null;
      isRemoteLabelManuallyEdited.current = false;
      onSuccess();
    } catch (err: unknown) {
      const error = err as Error & { code?: string };
      if (error.name === 'AbortError' || error.message === 'Aborted') {
        cancelRemoteIngest();
        return;
      }

      setRemoteStatus('idle');
      remoteAbortControllerRef.current = null;

      if (
        error.code === 'S3_NOT_CONFIGURED' ||
        error.code === 'S3NotConfiguredError' ||
        error.message.includes('S3_NOT_CONFIGURED') ||
        error.message.includes('not configured')
      ) {
        setRemoteS3Warning(
          'S3 cloud storage service is not configured on the backend. Remote video ingestion is currently unavailable.'
        );
        toast.error('video.remote_ingest', {
          description: 'S3 storage service is not configured',
        });
      } else {
        setRemoteError(error.message);
        toast.error('video.remote_ingest', {
          description: `Failed to ingest video: ${error.message}`,
        });
      }
    }
  };

  return (
    <div className="p-3 border border-c rounded bg-card space-y-3">
      <div className="text-xs font-medium mono text-muted uppercase">Ingest Remote Video URL to S3</div>

      {remoteS3Warning && (
        <div className="p-2.5 rounded border border-amber-200 dark:border-amber-900/50 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
          <svg
            className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
          </svg>
          <div>
            <div className="font-semibold">S3 Storage Unconfigured</div>
            <div className="text-[11px] mt-0.5">{remoteS3Warning}</div>
          </div>
        </div>
      )}

      {remoteError && (
        <div className="p-2.5 rounded border border-red-200 dark:border-red-900/50 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs">
          <div className="font-semibold">Ingest Error</div>
          <div className="text-[11px] mt-0.5">{remoteError}</div>
        </div>
      )}

      <div>
        <Label htmlFor="remote-url" className="text-[10px] text-muted">
          Video URL
        </Label>
        <Input
          id="remote-url"
          placeholder="https://example.com/video.mp4"
          value={remoteUrl}
          onChange={(e) => handleRemoteUrlChange(e.target.value)}
          disabled={isIngesting}
          className="text-xs h-8"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="remote-label" className="text-[10px] text-muted">
            Label
          </Label>
          <Input
            id="remote-label"
            placeholder="e.g. S3 1080p"
            value={remoteLabel}
            onChange={(e) => {
              setRemoteLabel(e.target.value);
              isRemoteLabelManuallyEdited.current = true;
            }}
            disabled={isIngesting}
            className="text-xs h-8"
          />
        </div>
        <div>
          <Label htmlFor="remote-quality" className="text-[10px] text-muted">
            Quality
          </Label>
          <Input
            id="remote-quality"
            placeholder="e.g. 1080p"
            value={remoteQuality}
            onChange={(e) => {
              setRemoteQuality(e.target.value);
              isRemoteLabelManuallyEdited.current = true;
            }}
            disabled={isIngesting}
            className="text-xs h-8"
          />
        </div>
      </div>

      {providers.length > 0 && (
        <div>
          <Label htmlFor="remote-provider-select" className="text-[10px] text-muted">
            Target S3 Storage Provider
          </Label>
          <Select
            value={remoteProviderId || defaultProvider?.id || ''}
            onValueChange={(val) => setRemoteProviderId(val)}
            disabled={isIngesting}
          >
            <SelectTrigger
              id="remote-provider-select"
              data-testid="remote-provider-select"
              className="w-full h-8 px-2 text-xs mono"
            >
              <SelectValue placeholder="Select storage provider" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} {p.isDefault ? '(Default)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Collapsible Advanced Headers */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowAdvancedHeaders(!showAdvancedHeaders)}
          className="text-xs text-muted hover:text-foreground flex items-center gap-1 font-mono transition-colors"
        >
          <span>{showAdvancedHeaders ? '▼' : '►'}</span>
          <span>Advanced Headers</span>
        </button>

        {showAdvancedHeaders && (
          <div className="mt-2 p-2 border border-c rounded bg-sidebar space-y-2">
            <div>
              <Label htmlFor="remote-referer" className="text-[10px] text-muted">
                Referer Header
              </Label>
              <Input
                id="remote-referer"
                placeholder="e.g. https://remotehost.com"
                value={remoteReferer}
                onChange={(e) => setRemoteReferer(e.target.value)}
                disabled={isIngesting}
                className="text-xs h-8"
              />
            </div>
          </div>
        )}
      </div>

      {/* Ingest Progress Display */}
      {isIngesting && (
        <div className="p-2.5 border border-c rounded bg-sidebar space-y-2 text-xs">
          <div className="flex items-center justify-between mono">
            <span className="font-semibold text-foreground">Ingesting...</span>
            <span className="text-muted text-[11px]">
              {(remoteProgress.loaded / (1024 * 1024)).toFixed(1)} MB
              {remoteProgress.total > 0
                ? ` / ${(remoteProgress.total / (1024 * 1024)).toFixed(1)} MB (${remoteProgress.percent}%)`
                : ''}
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-2 transition-all duration-150"
              style={{ width: `${remoteProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {isIngesting ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="w-full text-xs h-8"
            onClick={cancelRemoteIngest}
          >
            Cancel Ingest
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="default"
            className="w-full text-xs h-8"
            disabled={!remoteUrl.trim() || !remoteLabel.trim()}
            onClick={handleRemoteIngest}
          >
            Ingest to S3
          </Button>
        )}
      </div>
    </div>
  );
}
