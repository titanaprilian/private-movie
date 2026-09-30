import { Clapperboard, Film, HardDrive, LayoutGrid } from 'lucide-react';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { formatGb, formatSeriesFooter, formatStorageValue, isStorageTracked } from './formatters';
import type {
  AdminDashboardCatalogStats,
  AdminDashboardStorageStats,
} from './api';

interface StatsRowProps {
  catalog?: AdminDashboardCatalogStats | null;
  storage?: AdminDashboardStorageStats | null;
}

function StatShell({
  testId,
  label,
  value,
  valueTestId,
  footer,
  iconBadge,
}: {
  testId: string;
  label: string;
  value: string;
  valueTestId: string;
  footer?: React.ReactNode;
  iconBadge: React.ReactNode;
}) {
  return (
    <ChunkyCard interactive data-testid={testId} className="min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-sans text-sm font-bold text-[var(--muted)]">{label}</div>
          <div
            data-testid={valueTestId}
            className="mt-1 font-display text-3xl font-extrabold tracking-tight text-[var(--ink)]"
          >
            {value}
          </div>
        </div>
        {iconBadge}
      </div>
      {footer && <div className="mt-2 font-sans text-xs font-semibold text-[var(--muted)]">{footer}</div>}
    </ChunkyCard>
  );
}

export function StatsRow({ catalog, storage }: StatsRowProps) {
  const tracked = isStorageTracked(storage ?? undefined);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="stats-row">
      <StatShell
        testId="kpi-total-series"
        label="Total series"
        value={catalog ? String(catalog.totalSeries) : '—'}
        valueTestId="kpi-total-series-value"
        iconBadge={
          <div
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-2 border-b-4 border-[var(--blue-dark)] bg-[var(--blue-soft)] text-[var(--blue)]"
          >
            <Clapperboard className="h-5 w-5" />
          </div>
        }
        footer={
          catalog ? (
            <span data-testid="kpi-series-footer">
              <span data-testid="kpi-ongoing-badge">{catalog.ongoingSeriesCount} ongoing</span>
              {' · '}
              <span data-testid="kpi-featured-badge">{catalog.featuredSeriesCount} featured</span>
              <span className="sr-only">{formatSeriesFooter(catalog.ongoingSeriesCount, catalog.featuredSeriesCount)}</span>
            </span>
          ) : undefined
        }
      />
      <StatShell
        testId="kpi-total-episodes"
        label="Total episodes"
        value={catalog ? String(catalog.totalEpisodes) : '—'}
        valueTestId="kpi-total-episodes-value"
        iconBadge={
          <div
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-2 border-b-4 border-[var(--purple-dark)] bg-[var(--purple)]/15 text-[var(--purple-dark)]"
          >
            <Film className="h-5 w-5" />
          </div>
        }
        footer={
          catalog ? (
            <span data-testid="kpi-episodes-footer">
              Across {catalog.totalSeries} {catalog.totalSeries === 1 ? 'series' : 'series'}
            </span>
          ) : undefined
        }
      />
      <StatShell
        testId="kpi-total-genres"
        label="Genres"
        value={catalog ? String(catalog.totalGenres) : '—'}
        valueTestId="kpi-total-genres-value"
        iconBadge={
          <div
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-2 border-b-4 border-[var(--gold-dark)] bg-[var(--gold)]/15 text-[var(--gold-dark)]"
          >
            <LayoutGrid className="h-5 w-5" />
          </div>
        }
        footer={
          catalog ? (
            <span data-testid="kpi-genres-footer">Used across the catalog</span>
          ) : undefined
        }
      />
      <StatShell
        testId="kpi-storage"
        label="Storage"
        value={storage ? formatStorageValue(storage) : 'Not tracked'}
        valueTestId="kpi-storage-value"
        iconBadge={
          <div
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-2 border-b-4 border-[var(--green-dark)] bg-[var(--green-soft)] text-[var(--green)]"
          >
            <HardDrive className="h-5 w-5" />
          </div>
        }
        footer={
          tracked && storage ? (
            <span data-testid="kpi-storage-percent">
              of {formatGb(storage.totalLimitBytes)} used ({storage.percentUsed.toFixed(1)}%)
            </span>
          ) : undefined
        }
      />
    </div>
  );
}
