import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChunkyActionMenuItem {
  label: string;
  onSelect: () => void;
  icon?: React.ReactNode;
  /** Red danger styling. */
  danger?: boolean;
  disabled?: boolean;
}

export interface ChunkyActionMenuProps {
  items: ChunkyActionMenuItem[];
  /** Accessible name for the kebab trigger. Defaults to "Open actions menu". */
  triggerLabel?: string;
  className?: string;
  contentClassName?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function ChunkyActionMenu({
  items,
  triggerLabel = 'Open actions menu',
  className,
  contentClassName,
  align = 'end',
  side = 'bottom',
}: ChunkyActionMenuProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const focusItem = (index: number) => {
    const count = items.length;
    if (count === 0) return;
    const next = ((index % count) + count) % count;
    itemRefs.current[next]?.focus();
  };

  const handleContentKeyDown = (e: React.KeyboardEvent) => {
    const active = document.activeElement;
    const currentIndex = itemRefs.current.findIndex((el) => el === active);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusItem(currentIndex === -1 ? 0 : currentIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusItem(currentIndex === -1 ? items.length - 1 : currentIndex - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusItem(items.length - 1);
    } else if (e.key === 'Escape') {
      // Radix closes on Escape; ensure focus returns to the trigger.
      e.stopPropagation();
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          requestAnimationFrame(() => triggerRef.current?.focus());
        }
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={triggerLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-all cursor-pointer hover:bg-[var(--surface-raised)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] active:translate-y-[2px] active:border-b-2',
            className
          )}
        >
          <MoreVertical className="h-5 w-5" aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          role="menu"
          align={align}
          side={side}
          sideOffset={8}
          onKeyDown={handleContentKeyDown}
          onOpenAutoFocus={(e) => {
            // Focus the first enabled item for immediate arrow-key navigation.
            e.preventDefault();
            const first = itemRefs.current.find((el) => el && !el.disabled);
            first?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            triggerRef.current?.focus();
          }}
          className={cn(
            'z-50 w-[180px] rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] p-2 shadow-[0_12px_32px_rgba(0,0,0,0.45)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            contentClassName
          )}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-50',
                item.danger
                  ? 'text-[var(--red)] hover:bg-[var(--red)]/15'
                  : 'text-[var(--ink)] hover:bg-[var(--surface-raised)]'
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
