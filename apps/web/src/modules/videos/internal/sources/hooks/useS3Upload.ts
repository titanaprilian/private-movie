import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { type StorageProviderItem } from '@/modules/storage';
import {
  uploadEpisodeVideoSource,
  getUploadProgress,
  getMaxUploadSizeMb,
  getMaxUploadSizeBytes,
} from '../../api';

export type S3UploadStatus = 'idle' | 'uploading';

export type S3UploadPhase = 'browser' | 'cloud';

export interface S3UploadProgress {
  percent: number;
  loaded: number;
  total: number;
}

export interface UseS3UploadOptions {
  episodeId: string;
  seriesId: string;
  defaultProvider: StorageProviderItem | null;
  onSuccess: () => void;
}

export interface UseS3UploadReturn {
  selectedFile: File | null;
  uploadLabel: string;
  setUploadLabel: (value: string) => void;
  uploadQuality: string;
  setUploadQuality: (value: string) => void;
  uploadProviderId: string;
  setUploadProviderId: (value: string) => void;
  uploadStatus: S3UploadStatus;
  uploadPhase: S3UploadPhase;
  uploadProgress: S3UploadProgress;
  s3Warning: string | null;
  isUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelect: (file: File | null) => void;
  cancelUpload: () => void;
  handleUpload: () => Promise<void>;
}

export function useS3Upload({
  episodeId,
  seriesId,
  defaultProvider,
  onSuccess,
}: UseS3UploadOptions): UseS3UploadReturn {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadQuality, setUploadQuality] = useState('');
  const [uploadProviderId, setUploadProviderId] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<S3UploadStatus>('idle');
  const [uploadPhase, setUploadPhase] = useState<S3UploadPhase>('browser');
  const [uploadProgress, setUploadProgress] = useState<S3UploadProgress>({
    percent: 0,
    loaded: 0,
    total: 0,
  });
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
        const maxGb =
          maxMb >= 1024 && maxMb % 1024 === 0 ? `${maxMb / 1024} GB` : `${maxMb} MB`;
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

  return {
    selectedFile,
    uploadLabel,
    setUploadLabel,
    uploadQuality,
    setUploadQuality,
    uploadProviderId,
    setUploadProviderId,
    uploadStatus,
    uploadPhase,
    uploadProgress,
    s3Warning,
    isUploading,
    fileInputRef,
    handleFileSelect,
    cancelUpload,
    handleUpload,
  };
}
