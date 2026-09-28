import * as React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

export interface BackButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** Button text. Defaults to "Back". */
  label?: string;
  /** Destination used when no custom onClick is supplied. Defaults to "/admin/videos". */
  to?: string;
  /** Custom click handler. When supplied, default router navigation is skipped. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Ref forwarded to the underlying button (spatial navigation). */
  backRef?: React.Ref<HTMLButtonElement>;
  /** When true with isSpatialMode, applies the spatial focus ring. */
  isFocused?: boolean;
  /** Enables spatial navigation focus styling. */
  isSpatialMode?: boolean;
}

export function BackButton({
  label = 'Back',
  to = '/admin/videos',
  onClick,
  backRef,
  isFocused = false,
  isSpatialMode = false,
  'aria-label': ariaLabel,
  className,
  type = 'button',
  ...rest
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (onClick) {
      onClick(e);
      return;
    }
    navigate({ to } as never);
  };

  return (
    <button
      ref={backRef}
      type={type}
      onClick={handleClick}
      aria-label={ariaLabel ?? label}
      className={cn(
        'inline-flex items-center gap-2 rounded-full bg-[var(--surface)] border-2 border-[#58cc02]/60 text-[var(--ink)] hover:border-[#58cc02] font-sans font-bold text-sm px-3.5 py-2 shadow-[0_3px_0_#46a302] border-b-4 border-b-[var(--green-dark)] active:translate-y-[2px] active:shadow-[0_1px_0_#46a302] transition-all cursor-pointer',
        isSpatialMode && isFocused && 'ring-2 ring-white',
        className
      )}
      {...rest}
    >
      <ChevronLeft className="h-4.5 w-4.5 stroke-[2.5]" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
