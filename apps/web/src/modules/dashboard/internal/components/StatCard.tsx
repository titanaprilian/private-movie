import { ChunkyCard } from '@/components/ui/chunky-card';
import type { StatCardProps } from '../types';

export function StatCard({ testId, label, value, valueTestId, footer, iconBadge }: StatCardProps) {
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
