import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FeaturedStarProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onToggle'> {
  featured: boolean;
  title?: string;
  onToggle: (e: React.MouseEvent) => void;
}

export function FeaturedStar({
  featured,
  title,
  onToggle,
  className,
  ...props
}: FeaturedStarProps) {
  return (
    <button
      type="button"
      aria-pressed={featured}
      title={featured ? 'Remove from featured' : 'Mark as featured'}
      aria-label={
        props['aria-label'] ??
        (featured ? `Remove ${title ?? 'series'} from featured` : `Mark ${title ?? 'series'} as featured`)
      }
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(e);
      }}
      data-featured={featured ? 'true' : 'false'}
      className={cn(
        'featured-star',
        'absolute top-2 right-2 z-10 w-11 h-11 rounded-2xl flex items-center justify-center',
        'border-2 border-b-4 font-extrabold transition-all cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] focus-visible:ring-offset-1 focus-visible:opacity-100',
        'active:translate-y-[2px] active:border-b-2',
        'backdrop-blur-xs shadow-xs',
        featured
          ? 'bg-[var(--gold-tint)] border-[var(--gold-dark)] text-[var(--gold)] opacity-100 hover:bg-[var(--gold-tint-hover)]'
          : 'bg-card/90 border-c text-muted hover:text-[var(--gold)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100',
        className
      )}
      {...props}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill={featured ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
