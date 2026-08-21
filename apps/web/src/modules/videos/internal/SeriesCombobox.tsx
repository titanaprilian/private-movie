import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import { seriesListQueryOptions, type SeriesItem } from './api';
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

export interface SeriesComboboxProps {
  value: string;
  onValueChange: (value: string, selectedSeries?: SeriesItem) => void;
  excludeSeriesId?: string;
  initialSeriesList?: SeriesItem[];
  id?: string;
  'aria-label'?: string;
}

export function SeriesCombobox({
  value,
  onValueChange,
  excludeSeriesId,
  initialSeriesList = [],
  id = 'add-relation-series',
  'aria-label': ariaLabel = 'Related Series',
}: SeriesComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  const { data, isLoading } = useQuery({
    ...seriesListQueryOptions({ q: debouncedQuery }),
    enabled: Boolean(debouncedQuery),
  });

  const querySeries = data?.series ?? [];

  // Map of all known series to resolve selectedItem title
  const knownSeriesMap = new Map<string, SeriesItem>();
  initialSeriesList.forEach((item) => knownSeriesMap.set(item.id, item));
  querySeries.forEach((item) => knownSeriesMap.set(item.id, item));

  // If user entered a search query, show search results from query. Otherwise fallback to initialSeriesList.
  const rawList = debouncedQuery ? querySeries : initialSeriesList;

  const availableSeries = rawList.filter(
    (item) => item.id !== excludeSeriesId
  );

  const selectedItem = knownSeriesMap.get(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          aria-label={ariaLabel}
          title={selectedItem ? selectedItem.title : 'Select a series...'}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full min-w-0 max-w-full justify-between text-xs h-8 font-normal bg-transparent border-c hover-bg text-fg px-2.5 overflow-hidden flex items-center"
        >
          <span className="truncate min-w-0 flex-1 text-left block">
            {selectedItem ? selectedItem.title : 'Select a series...'}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50 text-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[240px] max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search series..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading && (
              <div className="py-3 text-center text-xs text-muted mono">
                Searching...
              </div>
            )}
            {!isLoading && availableSeries.length === 0 && (
              <CommandEmpty>No series found.</CommandEmpty>
            )}
            <CommandGroup>
              {availableSeries.map((series) => {
                const isSelected = value === series.id;
                return (
                  <CommandItem
                    key={series.id}
                    value={series.id}
                    onSelect={() => {
                      onValueChange(series.id, series);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-3.5 w-3.5 shrink-0',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="truncate min-w-0 flex-1 block" title={series.title}>{series.title}</span>
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
