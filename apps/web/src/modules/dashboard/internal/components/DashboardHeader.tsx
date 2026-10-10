import { Link } from '@tanstack/react-router';
import { Plus, RefreshCw } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import type { DashboardHeaderProps } from '../types';

export function DashboardHeader({ isFetching, onRefresh }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ink)]">
          Dashboard
        </h1>
        <p className="font-sans text-sm font-semibold text-[var(--muted)] mt-1">
          Catalog overview and quick actions for your library.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <ChunkyButton
          variant="outline"
          onClick={onRefresh}
          aria-label="Refresh dashboard"
          disabled={isFetching}
        >
          <RefreshCw
            aria-hidden="true"
            className={isFetching ? 'animate-spin' : ''}
          />
          Refresh
        </ChunkyButton>
        <Link to="/admin/videos" aria-label="Add Series">
          <ChunkyButton variant="primary">
            <Plus aria-hidden="true" />
            Add Series
          </ChunkyButton>
        </Link>
      </div>
    </div>
  );
}
