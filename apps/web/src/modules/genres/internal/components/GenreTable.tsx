import { Search } from 'lucide-react';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyCard, ChunkyCardList } from '@/components/ui/chunky-card';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import { GenreRow } from './GenreRow';
import type { GenreSortField, GenreTableProps } from '../types';

function SortHeaderButton({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
  centered,
}: {
  label: string;
  field: GenreSortField;
  sortField: GenreSortField | null;
  sortDirection: 'asc' | 'desc';
  onSort: (field: GenreSortField) => void;
  centered?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      aria-label={`Sort by ${label}`}
      className={`flex items-center gap-1 font-extrabold uppercase hover:text-[var(--ink)] cursor-pointer transition-colors ${centered ? 'justify-center w-full' : ''}`}
    >
      <span>{label}</span>
      <span className="text-[10px]">
        {sortField === field ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  );
}

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
    <>
      {/* Toolbar / Search */}
      <div className="rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
          />
          <ChunkyInput
            placeholder="Search genres..."
            aria-label="Search genres"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <span
          data-testid="genre-count"
          className="ml-auto rounded-xl border-2 border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 font-sans text-xs font-extrabold uppercase tracking-[0.7px] text-[var(--muted)]"
        >
          {genres.length} {genres.length === 1 ? 'genre' : 'genres'}
        </span>
      </div>

      {/* Genre Card-Row Grid */}
      <div className="w-full">
        {genres.length > 0 && !isLoading && !isError && (
          <div className="genre-head select-none" role="row">
            <SortHeaderButton
              label="#"
              field="displayOrder"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
              centered
            />
            <SortHeaderButton
              label="Genre"
              field="name"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
            />
            <SortHeaderButton
              label="Badge"
              field="isBigGenre"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
            />
            <SortHeaderButton
              label="Order"
              field="displayOrder"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
              centered
            />
            <span aria-hidden="true" />
          </div>
        )}

        {isLoading ? (
          <ChunkyCardList data-testid="genre-skeleton-list">
            {[0, 1, 2].map((i) => (
              <ChunkySkeleton
                key={i}
                className="h-[76px] w-full border-2"
                data-testid="genre-skeleton-row"
              />
            ))}
            <span className="sr-only">Loading genres...</span>
          </ChunkyCardList>
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
          <ChunkyCardList data-testid="genre-card-grid">
            {genres.map((genre, index) => (
              <GenreRow
                key={genre.id}
                genre={genre}
                index={index}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </ChunkyCardList>
        )}
      </div>
    </>
  );
}
