import type { ActivityTagProps } from '../types';

export function ActivityTag({ kind }: ActivityTagProps) {
  if (kind === 'failed') {
    return (
      <span className="shrink-0 rounded-lg border border-red-300 bg-red-100 px-1.5 py-0.5 font-sans text-[11px] font-extrabold text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
        Failed
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-1.5 py-0.5 font-sans text-[11px] font-extrabold text-[var(--muted)]">
      Updated
    </span>
  );
}
