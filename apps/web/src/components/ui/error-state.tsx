import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ChunkyButton } from './chunky-button';
import { ChunkyCard } from './chunky-card';
import { cn } from '@/lib/utils';

export type ErrorStateTone = 'danger' | 'warning';

export interface ErrorStateProps {
  /** Headline shown in the error card. */
  title: string;
  /** Explanatory message rendered below the headline. */
  description?: string;
  /** When provided, a retry button invoking this callback is rendered. */
  onRetry?: () => void;
  /** Retry button label. Defaults to "Retry". */
  retryLabel?: string;
  /** Color treatment. Defaults to "danger". */
  tone?: ErrorStateTone;
  /** Passed through as `data-testid`. Defaults to "error-state". */
  testId?: string;
  className?: string;
}

const toneStyles: Record<
  ErrorStateTone,
  { badge: string; button: 'danger' | 'gold' }
> = {
  danger: {
    badge: 'border-[var(--red-dark)] bg-[var(--red)] text-white',
    button: 'danger',
  },
  warning: {
    badge: 'border-[var(--gold-dark)] bg-[var(--gold)]/20 text-[var(--gold-dark)]',
    button: 'gold',
  },
};

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Retry',
  tone = 'danger',
  testId = 'error-state',
  className,
}: ErrorStateProps) {
  const styles = toneStyles[tone];
  return (
    <ChunkyCard
      data-testid={testId}
      className={cn('max-w-md w-full p-6 text-center space-y-4', className)}
    >
      <div
        className={cn(
          'mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-b-4',
          styles.badge
        )}
      >
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="font-display text-xl font-bold text-[var(--ink)]">
        {title}
      </h2>
      {description && (
        <p className="font-sans text-sm font-semibold text-[var(--muted)]">
          {description}
        </p>
      )}
      {onRetry && (
        <ChunkyButton variant={styles.button} size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          {retryLabel}
        </ChunkyButton>
      )}
    </ChunkyCard>
  );
}
