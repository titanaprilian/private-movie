import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import type { WatchViewErrorStateProps } from '../types';

export function WatchViewSkeleton() {
  return (
    <div
      className="dark min-h-screen bg-[var(--bg)] text-fg font-sans animate-pulse"
      data-testid="watch-skeleton"
      style={{ colorScheme: 'dark' }}
    >
      <ChunkySkeleton className="w-full h-[50vh] sm:h-[60vh] rounded-none border-0" />
      <div className="px-4 sm:px-8 md:px-12 lg:px-16 py-6 space-y-8">
        <div className="space-y-4 max-w-4xl">
          <ChunkySkeleton className="h-6 w-36" />
          <ChunkySkeleton className="h-10 w-44" />
          <ChunkySkeleton className="h-16 w-full" />
        </div>
        <div className="space-y-4">
          <ChunkySkeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ChunkySkeleton key={i} className="aspect-video w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WatchViewErrorState({
  message,
  onRetry,
}: WatchViewErrorStateProps) {
  return (
    <div
      className="dark min-h-screen bg-[var(--bg)] text-fg font-sans flex items-center justify-center p-4"
      data-testid="watch-error"
      style={{ colorScheme: 'dark' }}
    >
      <ErrorState
        title="Failed to load series"
        description={
          message ||
          'Unable to fetch watch details. Please check your connection and try again.'
        }
        onRetry={onRetry}
      />
    </div>
  );
}
