import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import type { DummyVideo } from './types';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function truncateTitle(title: string, max: number): string {
  if (title.length <= max) return title;
  return title.slice(0, max).trimEnd() + '…';
}

export interface VideoCardProps {
  video: DummyVideo;
}

export function VideoCard({ video }: VideoCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      data-testid="video-card"
      className="group relative bg-card border border-c rounded overflow-hidden"
    >
      <div className="relative aspect-video overflow-hidden bg-black/10">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-primary-fg ml-0.5"
            >
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium leading-snug line-clamp-2">
              {truncateTitle(video.title, 48)}
            </h3>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
              <span className="mono">{video.source}</span>
              {video.videoType && (
                <>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <span className="mono">{video.videoType}</span>
                </>
              )}
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="mono">{formatDate(video.createdAt)}</span>
            </div>
          </div>

          <div className="shrink-0">
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="More actions"
                  className="p-1 rounded text-muted hover:text-current hover-bg cursor-pointer transition-colors"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
                  </svg>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-32 p-0 py-1 border border-c rounded shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-left px-3 py-1.5 text-xs hover-bg transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-left px-3 py-1.5 text-xs hover-bg text-red-600 dark:text-red-400 transition-colors"
                >
                  Delete
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </div>
  );
}
