import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CustomVideoPlayer } from '@/modules/videos';
import { getStoragePreviewUrl } from './api';

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
            setError(err instanceof Error ? err.message : 'Failed to generate preview URL');
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl w-[95vw] p-4 bg-card border-c rounded sm:rounded"
        aria-describedby={undefined}
      >
        <DialogHeader className="space-y-1 pb-2 border-b border-c">
          <DialogTitle className="text-sm font-semibold truncate text-fg">
            Preview Video: {filename || fileKey}
          </DialogTitle>
          <p className="text-[11px] mono text-muted truncate">{fileKey}</p>
        </DialogHeader>

        <div className="relative aspect-video w-full overflow-hidden rounded border border-c bg-black mt-2 flex items-center justify-center">
          {isLoading ? (
            <div className="text-xs mono text-muted animate-pulse" data-testid="preview-loading">
              Generating presigned playback URL...
            </div>
          ) : error ? (
            <div className="text-xs text-red-400 p-4 text-center mono" data-testid="preview-error">
              {error}
            </div>
          ) : previewUrl ? (
            <CustomVideoPlayer
              src={previewUrl}
              title={filename || fileKey}
              autoPlay={false}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
