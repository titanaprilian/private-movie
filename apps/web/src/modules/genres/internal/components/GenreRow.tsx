import { Pencil, Trash2 } from 'lucide-react';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { ChunkyActionMenu } from '@/components/ui/chunky-action-menu';
import type { GenreRowProps } from '../types';

export function GenreRow({ genre, index, onEdit, onDelete }: GenreRowProps) {
  return (
    <ChunkyCard
      data-testid={`genre-card-${genre.id}`}
      className="genre-row hover:-translate-y-[2px] hover:shadow-lg transition-all"
    >
      {/* Tactile index badge */}
      <span
        aria-hidden="true"
        className="flex h-10 w-12 items-center justify-center rounded-xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface-raised)] font-sans text-[15px] font-extrabold text-[var(--blue)]"
      >
        {index + 1}
      </span>

      {/* Name + slug */}
      <div className="min-w-0">
        <p className="truncate font-sans text-[15px] font-extrabold leading-snug text-[var(--ink)]">
          {genre.name}
        </p>
        <p className="truncate font-mono text-[13px] font-semibold text-[var(--muted)]">
          {genre.slug}
        </p>
      </div>

      {/* Big Genre badge */}
      <div>
        {genre.isBigGenre ? (
          <span className="inline-flex items-center rounded-full border-2 border-b-4 border-[var(--yellow-dark)] bg-[var(--yellow)] px-3 py-1 font-sans text-[11px] font-extrabold uppercase tracking-[0.7px] text-[#201a00]">
            Big Genre
          </span>
        ) : (
          <span className="font-mono text-xs font-semibold text-[var(--muted)]">
            —
          </span>
        )}
      </div>

      {/* Display order */}
      <span className="text-center font-mono text-sm font-bold text-[var(--ink)]">
        {genre.displayOrder ?? 0}
      </span>

      {/* Row actions */}
      <div className="flex items-center justify-end">
        <ChunkyActionMenu
          triggerLabel={`Actions for ${genre.name}`}
          items={[
            {
              label: 'Edit',
              icon: <Pencil className="h-4 w-4" aria-hidden="true" />,
              onSelect: () => onEdit(genre),
            },
            {
              label: 'Delete',
              icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
              danger: true,
              onSelect: () => onDelete(genre),
            },
          ]}
        />
      </div>
    </ChunkyCard>
  );
}
