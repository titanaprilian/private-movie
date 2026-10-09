import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogBody,
} from '@/components/ui/chunky-dialog';
import { VideoPlayer } from '@/components/media/VideoPlayer';
import { formatEmbedUrl, getEmbedIframeSandbox } from '@/lib/media';
import type { VideoSource } from '../api';

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
    <ChunkyDialog open={open} onOpenChange={onOpenChange}>
      <ChunkyDialogContent
        className="max-w-3xl"
        aria-describedby={undefined}
      >
        <ChunkyDialogHeader className="space-y-1 pb-2">
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
            <ChunkyDialogTitle className="text-sm truncate">
              {source.label || 'Source Preview'}
              {episodeTitle ? ` — ${episodeTitle}` : ''}
            </ChunkyDialogTitle>
          </div>
          <p className="text-[11px] mono text-muted truncate">{source.url}</p>
        </ChunkyDialogHeader>

        <ChunkyDialogBody>
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-black mt-2">
          {isEmbed && embedUrl ? (
            <iframe
              src={embedUrl}
              title={source.label || 'Video Source Preview'}
              className="w-full h-full border-0"
              sandbox={getEmbedIframeSandbox(source.url)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
            />
          ) : (
            <VideoPlayer
              src={source.url}
              title={`${source.label || 'Direct Video'} (${source.quality || 'Auto'})`}
              autoPlay={false}
            />
          )}
        </div>
        </ChunkyDialogBody>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
