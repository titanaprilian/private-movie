import type * as React from 'react';
import type {
  CountBadgeProps,
  IngestionBadgeProps,
  IngestionStatusBadgeProps,
} from '../types';

const baseBadgeClassName =
  'rounded-full px-2.5 py-1 text-xs font-extrabold border-2';

export function PillBadge({ children, ...props }: IngestionBadgeProps & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`${baseBadgeClassName} border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]`}
      {...props}
    >
      {children}
    </span>
  );
}

export function WarningBadge({ children, ...props }: IngestionBadgeProps & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`${baseBadgeClassName} border-[var(--gold-dark)] bg-[var(--gold-tint)] text-[var(--gold)]`}
      {...props}
    >
      {children}
    </span>
  );
}

export function ProviderBadge({
  children,
  ...props
}: IngestionBadgeProps & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`${baseBadgeClassName} border-[var(--purple)] bg-[var(--purple)]/10 text-[var(--purple)]`}
      {...props}
    >
      {children}
    </span>
  );
}

export function MetaBadge({ children, ...props }: IngestionBadgeProps & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`${baseBadgeClassName} border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]`}
      {...props}
    >
      {children}
    </span>
  );
}

export function CountBadge({ children, tone = 'green' }: CountBadgeProps) {
  const toneClasses =
    tone === 'green'
      ? 'border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]'
      : tone === 'blue'
        ? 'border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue)]'
        : 'border-[var(--gold-dark)] bg-[var(--gold-tint)] text-[var(--gold)]';
  return (
    <span className={`${baseBadgeClassName} ${toneClasses}`}>{children}</span>
  );
}

export function FieldBadge({ children, ...props }: IngestionBadgeProps & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`${baseBadgeClassName} border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue)]`}
      {...props}
    >
      {children}
    </span>
  );
}

function statusTone(status: string): string {
  if (status === 'completed' || status === 'success') {
    return 'border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]';
  }
  if (status === 'ingesting' || status === 'uploading' || status === 'processing') {
    return 'border-[var(--gold-dark)] bg-[var(--gold-tint)] text-[var(--gold)] animate-pulse';
  }
  if (status === 'failed' || status === 'error') {
    return 'border-[var(--red)] bg-[var(--red)]/10 text-[var(--red)]';
  }
  return 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]';
}

export function StatusBadge({ status }: IngestionStatusBadgeProps) {
  return (
    <span
      className={`shrink-0 ${baseBadgeClassName} uppercase tracking-wide ${statusTone(status)}`}
    >
      {status}
    </span>
  );
}
