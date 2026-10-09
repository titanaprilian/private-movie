import { useState, useEffect } from 'react';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
  ChunkyDialogBody,
} from '@/components/ui/chunky-dialog';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import { VideoPlayer } from '@/components/media/VideoPlayer';
import { getStoragePreviewUrl } from '../../api';

export interface VideoPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileKey: string | null;
  filename?: string;
}

export function VideoPreviewModal({
  open,
  onOpenChange,
  fileKey,
  filename,
}: VideoPreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (open && fileKey) {
      setIsLoading(true);
      setError(null);
      getStoragePreviewUrl(fileKey)
        .then((url) => {
          if (isMounted) {
            setPreviewUrl(url);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(
              err instanceof Error
                ? err.message
                : 'Failed to generate preview URL'
            );
            setIsLoading(false);
          }
        });
    } else {
      setPreviewUrl(null);
      setIsLoading(false);
      setError(null);
    }
    return () => {
      isMounted = false;
    };
  }, [open, fileKey]);

  if (!fileKey) return null;

  return (
    <ChunkyDialog open={open} onOpenChange={onOpenChange}>
      <ChunkyDialogContent
        className="max-w-3xl"
        aria-label={`Preview video ${filename || fileKey}`}
      >
        <ChunkyDialogHeader>
          <ChunkyDialogTitle className="truncate">
            Preview Video: {filename || fileKey}
          </ChunkyDialogTitle>
          <ChunkyDialogDescription className="font-mono truncate">
            {fileKey}
          </ChunkyDialogDescription>
        </ChunkyDialogHeader>

        <ChunkyDialogBody>
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-black flex items-center justify-center">
            {isLoading ? (
              <ChunkySkeleton
                className="absolute inset-0 rounded-none border-0"
                data-testid="preview-loading"
              >
                <span className="sr-only">
                  Generating presigned playback URL...
                </span>
              </ChunkySkeleton>
            ) : error ? (
              <div
                className="font-mono text-xs font-bold text-[var(--red)] p-4 text-center"
                data-testid="preview-error"
              >
                {error}
              </div>
            ) : previewUrl ? (
              <VideoPlayer
                src={previewUrl}
                title={filename || fileKey}
                autoPlay={false}
              />
            ) : null}
          </div>
        </ChunkyDialogBody>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
