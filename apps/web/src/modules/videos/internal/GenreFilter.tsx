import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Filter, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyChip } from '@/components/ui/chunky-chip';
import { genresQueryOptions } from '@/modules/genres';
import { cn } from '@/lib/utils';

/**
 * Sentinel command value that matches no genre row. cmdk auto-highlights the
 * first row whenever its internal value is falsy (on mount and on list
 * changes), so holding a truthy non-matching value keeps the panel free of
 * pre-highlight until the user hovers or uses arrow keys intentionally.
 */
const NO_HIGHLIGHT = '__genre-filter-no-highlight__';

export interface GenreFilterProps {
  selectedSlugs: string[];
  onSelectionChange: (slugs: string[]) => void;
}

function triggerLabel(selectedSlugs: string[], namesBySlug: Map<string, string>): string {
  if (selectedSlugs.length === 0) return 'Filter by genre';
  if (selectedSlugs.length === 1) {
    return namesBySlug.get(selectedSlugs[0]) ?? selectedSlugs[0];
  }
  return `${selectedSlugs.length} genres`;
}

export function GenreFilter({ selectedSlugs, onSelectionChange }: GenreFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlight, setHighlight] = useState<string>(NO_HIGHLIGHT);
  // While true, highlight updates coming from cmdk are side effects of the
  // search filter changing (unmount-driven auto-select), not user intent.
  const searchChangedRef = useRef(false);

  const { data: genres = [], isLoading, isError, refetch } = useQuery(genresQueryOptions());

  // Reset the suppression flag after commit: cmdk's filter-driven auto-select
  // runs in layout effects, so passive effects observe it as still suppressed.
  useEffect(() => {
    searchChangedRef.current = false;
  });

  const namesBySlug = new Map(genres.map((g) => [g.slug, g.name]));
  const normalizedSearch = search.trim().toLowerCase();
  const visibleGenres =
    normalizedSearch.length === 0
      ? genres
      : genres.filter(
          (g) =>
            g.name.toLowerCase().includes(normalizedSearch) ||
            g.slug.toLowerCase().includes(normalizedSearch)
        );

  const toggleGenre = (slug: string) => {
    if (selectedSlugs.includes(slug)) {
      onSelectionChange(selectedSlugs.filter((s) => s !== slug));
    } else {
      onSelectionChange([...selectedSlugs, slug]);
    }
  };

  const handleSearchChange = (value: string) => {
    searchChangedRef.current = true;
    setSearch(value);
    // Clear any existing highlight when the result set changes.
    setHighlight(NO_HIGHLIGHT);
  };

  const handleHighlightChange = (value: string) => {
    if (searchChangedRef.current) return;
    setHighlight(value || NO_HIGHLIGHT);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setSearch('');
      setHighlight(NO_HIGHLIGHT);
    }
  };

  const isActive = selectedSlugs.length > 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <ChunkyChip
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={triggerLabel(selectedSlugs, namesBySlug)}
          variant={isActive ? 'active' : 'default'}
          className={cn('min-w-[170px] shrink-0', open && 'border-[var(--blue)]')}
        >
          <Filter aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="truncate">{triggerLabel(selectedSlugs, namesBySlug)}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')}
          />
        </ChunkyChip>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] p-0 shadow-2xl"
      >
        <Command
          value={highlight}
          onValueChange={handleHighlightChange}
          shouldFilter={false}
          label="Filter series by genre"
          className="rounded-2xl bg-transparent"
        >
          <div className="flex items-center gap-2 border-b-2 border-[var(--border)] px-3">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search genres..."
              aria-label="Search genres"
              className="flex h-11 w-full bg-transparent text-sm font-semibold text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:placeholder:text-[var(--muted)] border-0 focus:ring-0"
            />
          </div>
          {isLoading ? (
            <div role="status" aria-label="Loading genres" className="space-y-2 p-3">
              <span className="sr-only">Loading genres</span>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  className="h-11 animate-pulse rounded-[14px] bg-[var(--surface-raised)]"
                />
              ))}
            </div>
          ) : isError ? (
            <div role="alert" className="space-y-2 p-4 text-center">
              <p className="text-sm font-bold text-[var(--ink)]">Failed to load genres</p>
              <ChunkyButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                Retry
              </ChunkyButton>
            </div>
          ) : (
            <CommandList className="max-h-[240px] p-1.5">
              <CommandEmpty>No genres found.</CommandEmpty>
              <CommandGroup>
                {visibleGenres.map((genre) => {
                  const selected = selectedSlugs.includes(genre.slug);
                  return (
                    <CommandItem
                      key={genre.id}
                      value={genre.slug}
                      keywords={[genre.name]}
                      onSelect={() => toggleGenre(genre.slug)}
                      className="flex cursor-pointer items-center gap-3 rounded-[12px] px-2.5 py-2 text-sm font-bold text-[var(--ink)] data-[selected=true]:bg-[var(--surface-raised)]"
                    >
                      <span
                        aria-hidden="true"
                        data-testid={`genre-checkbox-${genre.slug}`}
                        className={cn(
                          'grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition-colors',
                          selected
                            ? 'border-[var(--green-dark)] bg-[var(--green)]'
                            : 'border-[var(--border-strong)] bg-transparent'
                        )}
                      >
                        {selected && (
                          <Check aria-hidden="true" className="h-4 w-4 text-white" strokeWidth={3} />
                        )}
                      </span>
                      <span className="truncate">{genre.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          )}
          <div className="grid grid-cols-2 gap-2 border-t-2 border-[var(--border)] p-2.5">
            <ChunkyButton
              type="button"
              variant="outline"
              size="default"
              onClick={() => onSelectionChange([])}
            >
              Clear
            </ChunkyButton>
            <ChunkyButton type="button" size="default" onClick={() => setOpen(false)}>
              Done
            </ChunkyButton>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
