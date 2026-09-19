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
import {
  uploadEpisodeVideoSource,
  getUploadProgress,
  getMaxUploadSizeMb,
  getMaxUploadSizeBytes,
} from '../api';

export interface S3UploadTabProps {
  episodeId: string;
  seriesId: string;
  providers: StorageProviderItem[];
  defaultProvider: StorageProviderItem | null;
  onSuccess: () => void;
}

export function S3UploadTab({
  episodeId,
  seriesId,
  providers,
  defaultProvider,
  onSuccess,
}: S3UploadTabProps) {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadQuality, setUploadQuality] = useState('');
  const [uploadProviderId, setUploadProviderId] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading'>('idle');
  const [uploadPhase, setUploadPhase] = useState<'browser' | 'cloud'>('browser');
  const [uploadProgress, setUploadProgress] = useState({ percent: 0, loaded: 0, total: 0 });
  const [s3Warning, setS3Warning] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | number | null>(null);
  const isPollingRef = useRef(false);

  const isUploading = uploadStatus !== 'idle';

  useEffect(() => {
    if (defaultProvider) {
      setUploadProviderId((prev) => prev || defaultProvider.id);
    }
  }, [defaultProvider]);

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current as unknown as number);
      pollingIntervalRef.current = null;
    }
    isPollingRef.current = false;
  };

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const handleFileSelect = (file: File | null) => {
    if (file) {
      const maxBytes = getMaxUploadSizeBytes();
      if (file.size > maxBytes) {
        const maxMb = getMaxUploadSizeMb();
        const maxGb = maxMb >= 1024 && maxMb % 1024 === 0 ? `${maxMb / 1024} GB` : `${maxMb} MB`;
        toast.error('video.file_size_exceeded', {
          description: `File size exceeds the maximum limit of ${maxGb}`,
        });
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
    }
    setSelectedFile(file);
    if (file) {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      setUploadLabel((prev) => (prev ? prev : baseName));
    }
  };

  const cancelUpload = () => {
    stopPolling();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUploadStatus('idle');
    setUploadPhase('browser');
    setUploadProgress({ percent: 0, loaded: 0, total: 0 });
    setSelectedFile(null);
    setUploadLabel('');
    setUploadQuality('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadLabel.trim()) return;

    setS3Warning(null);
    stopPolling();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const sessionId = crypto.randomUUID();

    setUploadStatus('uploading');
    setUploadPhase('browser');
    setUploadProgress({ percent: 0, loaded: 0, total: selectedFile.size });

    try {
      await uploadEpisodeVideoSource(episodeId, {
        file: selectedFile,
        label: uploadLabel.trim(),
        quality: uploadQuality.trim() || undefined,
        storageProviderId: uploadProviderId || undefined,
        uploadSessionId: sessionId,
        signal: controller.signal,
        onProgress: (progress) => {
          if (progress.percent >= 100 && !isPollingRef.current) {
            isPollingRef.current = true;
            setUploadPhase('cloud');
            setUploadProgress({ percent: 0, loaded: 0, total: selectedFile.size });

            pollingIntervalRef.current = setInterval(async () => {
              try {
                const cloudProg = await getUploadProgress(sessionId);
                setUploadProgress({
                  percent: cloudProg.percent,
                  loaded: cloudProg.loaded,
                  total: cloudProg.total > 0 ? cloudProg.total : selectedFile.size,
                });
              } catch {
                // Ignore error if session expired or finished
              }
            }, 500);
          } else if (!isPollingRef.current) {
            setUploadProgress(progress);
          }
        },
      });

      if (controller.signal.aborted) return;

      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      toast.success('video.source_add', {
        description: 'Successfully uploaded and registered video source',
      });

      setUploadStatus('idle');
      setUploadPhase('browser');
      setUploadProgress({ percent: 0, loaded: 0, total: 0 });
      setSelectedFile(null);
      setUploadLabel('');
      setUploadQuality('');
      abortControllerRef.current = null;
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onSuccess();
    } catch (err: unknown) {
      const error = err as Error & { code?: string };
      if (error.name === 'AbortError' || error.message === 'Aborted') {
        cancelUpload();
        return;
      }

      setUploadStatus('idle');
      setUploadPhase('browser');
      abortControllerRef.current = null;

      if (
        error.code === 'S3_NOT_CONFIGURED' ||
        error.message.includes('S3_NOT_CONFIGURED') ||
        error.message.includes('not configured')
      ) {
        setS3Warning(
          'S3 cloud storage service is not configured on the backend. Direct video uploads are currently unavailable.'
        );
        toast.error('video.s3_upload', {
          description: 'S3 storage service is not configured',
        });
      } else {
        toast.error('video.s3_upload', {
          description: `Failed to upload video: ${error.message}`,
        });
      }
    } finally {
      stopPolling();
    }
  };

  return (
    <div className="p-3 border border-c rounded bg-card space-y-3">
      <div className="text-xs font-medium mono text-muted uppercase">Upload Video to S3</div>

      {s3Warning && (
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
            <div className="text-[11px] mt-0.5">{s3Warning}</div>
          </div>
        </div>
      )}

      {/* File Dropzone / Picker */}
      <div>
        <Label className="text-[10px] text-muted">Video File (.mp4, .mkv, .webm)</Label>
        <input
          type="file"
          ref={fileInputRef}
          accept="video/mp4,video/webm,video/x-matroska,.mp4,.mkv,.webm"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            handleFileSelect(file);
          }}
          disabled={isUploading}
        />
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (isUploading) return;
            const file = e.dataTransfer.files?.[0] || null;
            handleFileSelect(file);
          }}
          onClick={() => {
            if (!isUploading && fileInputRef.current) {
              fileInputRef.current.click();
            }
          }}
          className={`mt-1 border-2 border-dashed border-c rounded p-4 text-center cursor-pointer hover:border-primary transition-colors ${
            isUploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {selectedFile ? (
            <div className="text-xs mono space-y-1">
              <div className="font-semibold text-foreground truncate">{selectedFile.name}</div>
              <div className="text-muted text-[11px]">
                {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted space-y-1">
              <div className="font-medium text-foreground">Click to select or drag video here</div>
              <div className="text-[10px]">Supports MP4, MKV, WebM</div>
            </div>
          )}
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="upload-label" className="text-[10px] text-muted">
            Label
          </Label>
          <Input
            id="upload-label"
            placeholder="e.g. S3 High Quality"
            value={uploadLabel}
            onChange={(e) => setUploadLabel(e.target.value)}
            disabled={isUploading}
            className="text-xs h-8"
          />
        </div>
        <div>
          <Label htmlFor="upload-quality" className="text-[10px] text-muted">
            Quality
          </Label>
          <Input
            id="upload-quality"
            placeholder="e.g. 1080p"
            value={uploadQuality}
            onChange={(e) => setUploadQuality(e.target.value)}
            disabled={isUploading}
            className="text-xs h-8"
          />
        </div>
      </div>

      {/* Target S3 Provider Selector for Upload */}
      {providers.length > 0 && (
        <div>
          <Label htmlFor="upload-provider-select" className="text-[10px] text-muted">
            Target S3 Storage Provider
          </Label>
          <Select
            value={uploadProviderId || defaultProvider?.id || ''}
            onValueChange={(val) => setUploadProviderId(val)}
            disabled={isUploading}
          >
            <SelectTrigger
              id="upload-provider-select"
              data-testid="upload-provider-select"
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

      {/* Upload Progress Display */}
      {isUploading && (
        <div className="p-2.5 border border-c rounded bg-sidebar space-y-2 text-xs">
          <div className="flex items-center justify-between mono">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              {uploadPhase === 'cloud' ? (
                <>
                  <svg
                    className="animate-spin h-3 w-3 text-primary shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Uploading to cloud storage...</span>
                </>
              ) : (
                'Uploading...'
              )}
            </span>
            <span className="text-muted text-[11px]">
              {(uploadProgress.loaded / (1024 * 1024)).toFixed(1)} MB /{' '}
              {(uploadProgress.total / (1024 * 1024)).toFixed(1)} MB ({uploadProgress.percent}%)
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-2 transition-all duration-150"
              style={{ width: `${uploadProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {isUploading ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="w-full text-xs h-8"
            onClick={cancelUpload}
          >
            Cancel
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="default"
            className="w-full text-xs h-8"
            disabled={!selectedFile || !uploadLabel.trim()}
            onClick={handleUpload}
          >
            Upload
          </Button>
        )}
      </div>
    </div>
  );
}
