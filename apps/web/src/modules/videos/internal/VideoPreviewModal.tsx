import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CustomVideoPlayer } from './CustomVideoPlayer';
import { formatEmbedUrl } from './embedUrl';
import type { VideoSource } from './api';

export interface VideoPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: VideoSource | null;
  episodeTitle?: string;
}

export function VideoPreviewModal({
  open,
  onOpenChange,
  source,
  episodeTitle,
}: VideoPreviewModalProps) {
  if (!source) return null;

  const isEmbed = source.type === 'embed';
  const embedUrl = isEmbed ? formatEmbedUrl(source.url) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl w-[95vw] p-4 bg-card border-c rounded sm:rounded"
        aria-describedby={undefined}
      >
        <DialogHeader className="space-y-1 pb-2 border-b border-c">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] mono uppercase font-medium px-1.5 py-0.5 rounded border ${
                source.type === 's3'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-800'
                  : source.type === 'direct'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-800'
              }`}
            >
              {source.type}
            </span>
            <DialogTitle className="text-sm font-semibold truncate text-fg">
              {source.label || 'Source Preview'}
              {episodeTitle ? ` — ${episodeTitle}` : ''}
            </DialogTitle>
          </div>
          <p className="text-[11px] mono text-muted truncate">{source.url}</p>
        </DialogHeader>

        <div className="relative aspect-video w-full overflow-hidden rounded border border-c bg-black mt-2">
          {isEmbed && embedUrl ? (
            <iframe
              src={embedUrl}
              title={source.label || 'Video Source Preview'}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            />
          ) : (
            <CustomVideoPlayer
              src={source.url}
              title={source.label || episodeTitle || 'Source Preview'}
              autoPlay={false}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
