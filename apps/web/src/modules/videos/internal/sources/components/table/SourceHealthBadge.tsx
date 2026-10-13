import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { SourceHealthBadgeProps } from '../../types';

export function SourceHealthBadge({ status, title }: SourceHealthBadgeProps) {
  if (status === 'testing') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 font-mono text-[11px] font-extrabold text-[var(--muted)]"
        title={title ?? 'Testing source health...'}
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Testing
      </span>
    );
  }
  if (status === 'working') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-xl border-2 border-b-4 border-[var(--green-dark)] bg-[var(--green)] px-2 py-0.5 font-mono text-[11px] font-extrabold text-white"
        title={title ?? 'Working'}
      >
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Working
      </span>
    );
  }
  if (status === 'broken') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-xl border-2 border-b-4 border-[var(--red-dark)] bg-[var(--red)] px-2 py-0.5 font-mono text-[11px] font-extrabold text-white"
        title={title ?? 'Source probe failed'}
      >
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        Broken
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 font-mono text-[11px] font-extrabold text-[var(--muted)]"
      title={title ?? 'Health check pending or unknown'}
    >
      Unknown
    </span>
  );
}
