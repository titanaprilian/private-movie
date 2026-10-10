import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChunkyTooltip } from '@/components/ui/chunky-tooltip';

export interface ChunkyCopyButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'onCopy' | 'value'
  > {
  /** Exact text copied to the clipboard on click. */
  value: string;
  /** Accessible label for the button. Defaults to `Copy <value>`. */
  copyLabel?: string;
  /** Tooltip content. Defaults to the full value. */
  tooltip?: React.ReactNode;
  /** Called after a successful copy. */
  onCopied?: () => void;
  /** How long (ms) the checkmark feedback stays visible. */
  resetAfterMs?: number;
}

async function copyTextToClipboard(text: string): Promise<void> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall through to the legacy execCommand path below.
  }
  if (typeof document === 'undefined') return;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

/**
 * Inline copy icon button with a tooltip showing the full value and
 * checkmark feedback upon copying.
 */
function ChunkyCopyButton({
  value,
  copyLabel,
  tooltip,
  onCopied,
  resetAfterMs = 1500,
  className,
  onClick,
  ...props
}: ChunkyCopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onClick?.(e);
    await copyTextToClipboard(value);
    onCopied?.();
    setCopied(true);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setCopied(false), resetAfterMs);
  };

  return (
    <ChunkyTooltip content={tooltip ?? value}>
      <button
        type="button"
        aria-label={copyLabel ?? `Copy ${value}`}
        data-copied={copied || undefined}
        onClick={handleClick}
        className={cn(
          'inline-flex shrink-0 items-center justify-center w-6 h-6 rounded-lg border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-all hover:text-[var(--ink)] hover:border-[#4b5d67] active:translate-y-px cursor-pointer',
          copied && 'text-[var(--green)] border-[var(--green-dark)]',
          className
        )}
        {...props}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5" aria-hidden="true" data-testid="chunky-copy-check" />
        ) : (
          <Copy className="w-3.5 h-3.5" aria-hidden="true" data-testid="chunky-copy-icon" />
        )}
      </button>
    </ChunkyTooltip>
  );
}

export { ChunkyCopyButton };
