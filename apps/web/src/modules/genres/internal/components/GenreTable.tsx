import { Search } from 'lucide-react';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import {
  ChunkyTable,
  ChunkyTableToolbar,
  ChunkyTableHeader,
  ChunkyTableHeaderCell,
  ChunkyTableBody,
} from '@/components/ui/chunky-table';
import { GenreRow } from './GenreRow';
import type { GenreTableProps } from '../types';

export function GenreTable({
  genres,
  searchTerm,
  onSearchChange,
  sortField,
  sortDirection,
  onSort,
  isLoading,
  isError,
  error,
  onEdit,
  onDelete,
}: GenreTableProps) {
  return (
    <ChunkyTable>
      {/* Toolbar / Search */}
      <ChunkyTableToolbar className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
          />
          <ChunkyInput
            placeholder="Search genres..."
            aria-label="Search genres"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 font-mono"
          />
        </div>
        <span
          data-testid="genre-count"
          className="ml-auto rounded-xl border-2 border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 font-sans text-xs font-extrabold uppercase tracking-[0.7px] text-[var(--muted)]"
        >
          {genres.length} {genres.length === 1 ? 'genre' : 'genres'}
        </span>
      </ChunkyTableToolbar>

      {/* Genre Table Content */}
      <div className="w-full">
        {genres.length > 0 && !isLoading && !isError && (
          <ChunkyTableHeader className="grid-cols-[48px_minmax(0,1fr)_auto_72px_48px]">
            <ChunkyTableHeaderCell
              sortable
              sortDirection={sortField === 'displayOrder' ? sortDirection : null}
              onSort={() => onSort('displayOrder')}
              aria-label="Sort by #"
              className="text-center"
            >
              #
            </ChunkyTableHeaderCell>
            <ChunkyTableHeaderCell
              sortable
              sortDirection={sortField === 'name' ? sortDirection : null}
              onSort={() => onSort('name')}
              aria-label="Sort by Genre"
            >
              Genre
            </ChunkyTableHeaderCell>
            <ChunkyTableHeaderCell
              sortable
              sortDirection={sortField === 'isBigGenre' ? sortDirection : null}
              onSort={() => onSort('isBigGenre')}
              aria-label="Sort by Badge"
            >
              Badge
            </ChunkyTableHeaderCell>
            <ChunkyTableHeaderCell
              sortable
              sortDirection={sortField === 'displayOrder' ? sortDirection : null}
              onSort={() => onSort('displayOrder')}
              aria-label="Sort by Order"
              className="text-center"
            >
              Order
            </ChunkyTableHeaderCell>
            <span aria-hidden="true" />
          </ChunkyTableHeader>
        )}

        {isLoading ? (
          <ChunkyTableBody data-testid="genre-skeleton-list">
            {[0, 1, 2].map((i) => (
              <ChunkySkeleton
                key={i}
                className="h-[76px] w-full border-2"
                data-testid="genre-skeleton-row"
              />
            ))}
            <span className="sr-only">Loading genres...</span>
          </ChunkyTableBody>
        ) : isError ? (
          <ChunkyCard className="p-8 text-center">
            <p className="font-sans text-sm font-extrabold text-[var(--red)]">
              {error instanceof Error ? error.message : 'Error loading genres'}
            </p>
          </ChunkyCard>
        ) : genres.length === 0 ? (
          <ChunkyCard
            className="p-8 text-center"
            data-testid="genre-empty-state"
          >
            <p className="font-display text-xl font-bold text-[var(--ink)]">
              {searchTerm ? 'No genres match your search' : 'No genres yet'}
            </p>
            <p className="mt-1 font-sans text-sm font-semibold text-[var(--muted)]">
              {searchTerm
                ? 'Try a different name or slug keyword.'
                : 'Create your first genre to get started.'}
            </p>
          </ChunkyCard>
        ) : (
          <ChunkyTableBody data-testid="genre-card-grid">
            {genres.map((genre, index) => (
              <GenreRow
                key={genre.id}
                genre={genre}
                index={index}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </ChunkyTableBody>
        )}
      </div>
    </ChunkyTable>
  );
}
