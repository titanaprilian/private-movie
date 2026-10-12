import type { IngestionProgressBarProps } from '../types';

export function IngestionProgressBar({
  value,
  ariaLabel,
  tone = 'green',
  size = 'md',
  testId,
}: IngestionProgressBarProps) {
  const normalized = value == null ? null : Math.max(0, Math.min(100, Math.round(value)));
  const sizeClasses = size === 'sm' ? 'h-4 p-0.5' : 'h-5 p-1';
  const fillTone =
    tone === 'blue'
      ? 'bg-[var(--blue)] border-[var(--blue-dark)] shadow-[0_2px_0_var(--blue-dark)]'
      : 'bg-[var(--green)] border-[var(--green-dark)] shadow-[0_2px_0_var(--green-dark)]';

  return (
    <div
      className={`w-full rounded-full border-2 border-[var(--border)] bg-[var(--bg)] ${sizeClasses} overflow-hidden shadow-[inset_0_2px_0_rgba(0,0,0,0.15)]`}
      role="progressbar"
      aria-label={ariaLabel}
      {...(normalized != null
        ? { 'aria-valuenow': normalized, 'aria-valuemin': 0, 'aria-valuemax': 100 }
        : {})}
      {...(testId ? { 'data-testid': testId } : {})}
    >
      <div
        className={`${fillTone} h-full rounded-full border-r-2 transition-all duration-300 ${
          normalized == null ? 'animate-pulse' : ''
        }`}
        {...(normalized != null ? { style: { width: `${normalized}%` } } : {})}
      />
    </div>
  );
}
