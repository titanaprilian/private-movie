import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';

export function DashboardSkeletons() {
  return (
    <div
      className="space-y-6 w-full"
      data-testid="dashboard-skeleton"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <ChunkySkeleton className="h-9 w-48" />
          <ChunkySkeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ChunkySkeleton className="h-10 w-28" />
          <ChunkySkeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="dashboard-skeleton-stats">
        <ChunkySkeleton className="h-32" />
        <ChunkySkeleton className="h-32" />
        <ChunkySkeleton className="h-32" />
        <ChunkySkeleton className="h-32" />
      </div>

      <section aria-label="Loading scheduler">
        <ChunkySkeleton className="h-7 w-32" />
        <ChunkySkeleton className="mt-4 h-36 w-full" data-testid="dashboard-skeleton-scheduler" />
      </section>

      <section aria-label="Loading catalog">
        <ChunkySkeleton className="h-7 w-56" />
        <ChunkySkeleton className="mt-1 h-4 w-80" />
        <div
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="dashboard-skeleton-grid"
        >
          <ChunkySkeleton className="h-40" />
          <ChunkySkeleton className="h-40" />
          <ChunkySkeleton className="h-40" />
          <ChunkySkeleton className="h-40" />
          <ChunkySkeleton className="h-40" />
          <ChunkySkeleton className="h-40" />
        </div>
      </section>
    </div>
  );
}
