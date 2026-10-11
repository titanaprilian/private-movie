import { Pencil, Trash2 } from 'lucide-react';
import { ChunkyActionMenu } from '@/components/ui/chunky-action-menu';
import {
  ChunkyTableRow,
  ChunkyTableCell,
  ChunkyTableIndexBadge,
} from '@/components/ui/chunky-table';
import type { GenreRowProps } from '../types';

export function GenreRow({ genre, index, onEdit, onDelete }: GenreRowProps) {
  return (
    <ChunkyTableRow
      data-testid={`genre-card-${genre.id}`}
      interactive
      className="grid grid-cols-[48px_minmax(0,1fr)_auto_72px_48px] items-center gap-3 p-3"
    >
      {/* Tactile index badge */}
      <ChunkyTableCell className="flex justify-center">
        <ChunkyTableIndexBadge index={index + 1} />
      </ChunkyTableCell>

      {/* Name + slug */}
      <ChunkyTableCell>
        <p className="truncate font-sans text-[15px] font-extrabold leading-snug text-[var(--ink)]">
          {genre.name}
        </p>
        <p className="truncate font-mono text-[13px] font-semibold text-[var(--muted)]">
          {genre.slug}
        </p>
      </ChunkyTableCell>

      {/* Big Genre badge */}
      <ChunkyTableCell>
        {genre.isBigGenre ? (
          <span className="inline-flex items-center rounded-full border-2 border-b-4 border-[var(--yellow-dark)] bg-[var(--yellow)] px-3 py-1 font-sans text-[11px] font-extrabold uppercase tracking-[0.7px] text-[#201a00]">
            Big Genre
          </span>
        ) : (
          <span className="font-mono text-xs font-semibold text-[var(--muted)]">
            —
          </span>
        )}
      </ChunkyTableCell>

      {/* Display order */}
      <ChunkyTableCell className="text-center font-mono text-sm font-bold text-[var(--ink)]">
        {genre.displayOrder ?? 0}
      </ChunkyTableCell>

      {/* Row actions */}
      <ChunkyTableCell className="flex items-center justify-end">
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
      </ChunkyTableCell>
    </ChunkyTableRow>
  );
}
