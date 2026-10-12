import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { cn } from '@/lib/utils';
import type { TargetEpisodeComboboxProps } from '../../types';
import { useTargetEpisodeOptions } from '../hooks/useTargetEpisodeOptions';

export type { TargetEpisodeComboboxProps } from '../../types';

export function TargetEpisodeCombobox({
  value,
  onValueChange,
  disabled = false,
  scrapedTitle,
  seasons = [],
  localEpisodes = [],
  targetSeasonId,
}: TargetEpisodeComboboxProps) {
  const [open, setOpen] = useState(false);

  const { scopedEpisodes, seasonHeading, allEpisodes, formatEpisodeLabel } =
    useTargetEpisodeOptions(seasons, localEpisodes, targetSeasonId);

  let selectedLabel = '-- Skip / Unmapped --';
  if (value) {
    const foundEp =
      scopedEpisodes.find((ep) => ep.id === value) ?? allEpisodes.find((ep) => ep.id === value);
    if (foundEp) {
      selectedLabel = formatEpisodeLabel(foundEp);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ChunkyButton
          type="button"
          aria-label={`Target episode for ${scrapedTitle}`}
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          variant="outline"
          size="sm"
          className="w-full justify-between rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] px-3 font-sans text-xs font-bold normal-case tracking-normal text-[var(--ink)] hover:border-[var(--border-strong)]"
        >
          <span className="min-w-0 flex-1 truncate text-left">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
        </ChunkyButton>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] max-w-[calc(100vw-2rem)] rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-2xl"
        align="start"
      >
        <Command className="rounded-2xl bg-[var(--surface)] font-sans">
          <div className="border-b-2 border-[var(--border)] px-2 pb-2">
            <CommandInput
              placeholder="Search target episode..."
              className="h-11 rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] px-4 font-sans text-sm font-bold text-[var(--ink)] placeholder:font-semibold placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--blue)]/40"
            />
          </div>
          <CommandList className="p-1">
            <CommandEmpty className="py-6 text-center font-sans text-xs font-bold text-[var(--muted)]">
              No episode found.
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="skip-unmapped -- Skip / Unmapped --"
                onSelect={() => {
                  onValueChange(null);
                  setOpen(false);
                }}
                className="rounded-xl py-2.5 font-sans text-sm font-bold text-[var(--ink)] data-[selected=true]:bg-[var(--surface-raised)]"
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4 shrink-0 text-[var(--green)]',
                    !value ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <span>-- Skip / Unmapped --</span>
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading={seasonHeading ?? undefined} className="[&_[cmdk-group-heading]]:font-sans [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-extrabold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[var(--muted)]">
              {scopedEpisodes.map((ep) => {
                const isSelected = value === ep.id;
                const itemLabel = formatEpisodeLabel(ep);
                return (
                  <CommandItem
                    key={ep.id}
                    value={`${itemLabel} ${ep.id}`}
                    onSelect={() => {
                      onValueChange(ep.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'rounded-xl py-2.5 font-sans text-sm font-bold text-[var(--ink)] data-[selected=true]:bg-[var(--surface-raised)]',
                      isSelected && 'bg-[var(--green-soft)]'
                    )}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0 text-[var(--green)]',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="truncate">{itemLabel}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
