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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LocalEpisodeItem, SeasonGroupOption } from './useBulkScrapeSources';

export interface TargetEpisodeComboboxProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  disabled?: boolean;
  scrapedTitle: string;
  seasons?: SeasonGroupOption[];
  localEpisodes?: LocalEpisodeItem[];
}

export function TargetEpisodeCombobox({
  value,
  onValueChange,
  disabled = false,
  scrapedTitle,
  seasons = [],
  localEpisodes = [],
}: TargetEpisodeComboboxProps) {
  const [open, setOpen] = useState(false);

  let selectedLabel = '-- Skip / Unmapped --';
  if (value) {
    let foundEp: { id: string; title: string; order?: number } | undefined;
    if (seasons.length > 0) {
      for (const season of seasons) {
        foundEp = season.episodes?.find((ep) => ep.id === value);
        if (foundEp) break;
      }
    } else {
      foundEp = localEpisodes.find((ep) => ep.id === value);
    }
    if (foundEp) {
      selectedLabel = `Ep ${foundEp.order ?? '?'}: ${foundEp.title}`;
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          aria-label={`Target episode for ${scrapedTitle}`}
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          variant="outline"
          className="w-full justify-between text-xs h-8 font-normal bg-card border-c text-fg px-2.5 overflow-hidden flex items-center disabled:opacity-50"
        >
          <span className="truncate min-w-0 flex-1 text-left block">
            {selectedLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50 text-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[240px] max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search target episode..." />
          <CommandList>
            <CommandEmpty>No episode found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="skip-unmapped -- Skip / Unmapped --"
                onSelect={() => {
                  onValueChange(null);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-3.5 w-3.5 shrink-0',
                    !value ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <span>-- Skip / Unmapped --</span>
              </CommandItem>
            </CommandGroup>
            {seasons.length > 0 ? (
              seasons.map((season) => (
                <CommandGroup
                  key={season.id}
                  heading={season.title || `Season ${season.tmdbSeason ?? ''}`}
                >
                  {(season.episodes ?? []).map((ep) => {
                    const isSelected = value === ep.id;
                    const itemLabel = `Ep ${ep.order ?? '?'}: ${ep.title}`;
                    return (
                      <CommandItem
                        key={ep.id}
                        value={`${itemLabel} ${ep.id}`}
                        onSelect={() => {
                          onValueChange(ep.id);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-3.5 w-3.5 shrink-0',
                            isSelected ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <span className="truncate">{itemLabel}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))
            ) : (
              <CommandGroup>
                {localEpisodes.map((ep) => {
                  const isSelected = value === ep.id;
                  const itemLabel = `Ep ${ep.order ?? '?'}: ${ep.title}`;
                  return (
                    <CommandItem
                      key={ep.id}
                      value={`${itemLabel} ${ep.id}`}
                      onSelect={() => {
                        onValueChange(ep.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-3.5 w-3.5 shrink-0',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="truncate">{itemLabel}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
