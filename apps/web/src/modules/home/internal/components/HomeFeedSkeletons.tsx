import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';

export function HomeFeedHeroSkeleton() {
  return (
    <div
      data-testid="hero-skeleton"
      aria-busy="true"
      aria-label="Loading featured series"
      className="relative h-[100dvh] md:h-[85vh] min-h-[550px] w-full bg-[var(--bg)] flex items-end p-8 md:p-16"
    >
      <div className="max-w-3xl space-y-4 w-full">
        <ChunkySkeleton className="h-4 w-32" />
        <ChunkySkeleton className="h-12 w-3/4" />
        <div className="flex gap-3">
          <ChunkySkeleton className="h-4 w-20" />
          <ChunkySkeleton className="h-4 w-16" />
          <ChunkySkeleton className="h-4 w-24" />
        </div>
        <ChunkySkeleton className="h-16 w-full max-w-xl" />
        <div className="flex gap-4 pt-2">
          <ChunkySkeleton className="h-12 w-28" />
          <ChunkySkeleton className="h-12 w-32" />
        </div>
      </div>
    </div>
  );
}

export function HomeFeedRowSkeleton() {
  return (
    <div
      data-testid="carousel-row-skeleton"
      aria-busy="true"
      aria-label="Loading catalog rows"
      className="my-6 px-8 md:px-16 space-y-3"
    >
      <ChunkySkeleton className="h-7 w-48" />
      <div className="flex gap-4 overflow-hidden py-2">
        {Array.from({ length: 5 }).map((_, idx) => (
          <ChunkySkeleton
            key={idx}
            className="w-[160px] sm:w-[180px] aspect-[2/3] flex-shrink-0"
          />
        ))}
      </div>
    </div>
  );
}
