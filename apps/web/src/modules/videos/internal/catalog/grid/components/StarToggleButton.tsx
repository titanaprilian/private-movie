import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChunkyTooltip } from '@/components/ui/chunky-tooltip';

import type { StarToggleButtonProps } from '../../types';
export type { StarToggleButtonProps } from '../../types';

export function StarToggleButton({
  active,
  onToggle,
  activeLabel = 'Remove from featured',
  inactiveLabel = 'Mark as featured',
  activeTooltip = 'Remove from featured',
  inactiveTooltip = 'Mark as featured',
  iconSize = 20,
  className,
  ...props
}: StarToggleButtonProps) {
  return (
    <ChunkyTooltip content={active ? activeTooltip : inactiveTooltip}>
      <button
        type="button"
        aria-pressed={active}
        aria-label={
          props['aria-label'] ?? (active ? activeLabel : inactiveLabel)
        }
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle(e);
        }}
        data-active={active ? 'true' : 'false'}
        className={cn(
          'absolute top-2 right-2 z-10 w-11 h-11 rounded-2xl flex items-center justify-center',
          'border-2 border-b-4 font-extrabold transition-all cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] focus-visible:ring-offset-1 focus-visible:opacity-100',
          'active:translate-y-[2px] active:border-b-2',
          'backdrop-blur-xs shadow-xs',
          active
            ? 'bg-[var(--gold-tint)] border-[var(--gold-dark)] text-[var(--gold)] opacity-100 hover:bg-[var(--gold-tint-hover)]'
            : 'bg-card/90 border-c text-muted hover:text-[var(--gold)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100',
          className
        )}
        {...props}
      >
        <Star
          size={iconSize}
          strokeWidth={2}
          fill={active ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      </button>
    </ChunkyTooltip>
  );
}
