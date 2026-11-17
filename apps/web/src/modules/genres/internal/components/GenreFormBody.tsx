import { Loader2 } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';
import {
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';

export interface GenreFormBodyProps {
  idPrefix: string;
  error?: string | null;
  name: string;
  slug: string;
  isBigGenre: boolean;
  displayOrder: number;
  namePlaceholder?: string;
  slugPlaceholder?: string;
  onNameChange: (val: string) => void;
  onSlugChange: (val: string) => void;
  onBigGenreChange: (val: boolean) => void;
  onDisplayOrderChange: (val: number) => void;
  isPending: boolean;
  submitLabel: string;
  submittingLabel: string;
  onCancel: () => void;
}

export function GenreFormBody({
  idPrefix,
  error,
  name,
  slug,
  isBigGenre,
  displayOrder,
  namePlaceholder,
  slugPlaceholder,
  onNameChange,
  onSlugChange,
  onBigGenreChange,
  onDisplayOrderChange,
  isPending,
  submitLabel,
  submittingLabel,
  onCancel,
}: GenreFormBodyProps) {
  return (
    <>
      <ChunkyDialogBody className="space-y-4">
        {error && (
          <div className="rounded-2xl border-2 border-[var(--red-dark)] bg-[var(--red)]/10 px-4 py-3 font-sans text-xs font-bold text-[var(--red)]">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <label
            htmlFor={`${idPrefix}-name`}
            className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
          >
            Genre Name
          </label>
          <ChunkyInput
            id={`${idPrefix}-name`}
            placeholder={namePlaceholder}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor={`${idPrefix}-slug`}
            className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
          >
            Slug
          </label>
          <ChunkyInput
            id={`${idPrefix}-slug`}
            placeholder={slugPlaceholder}
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            required
          />
        </div>
        <div className="flex items-center space-x-2 pt-1">
          <ChunkyCheckbox
            id={`${idPrefix}-big`}
            checked={isBigGenre}
            onCheckedChange={onBigGenreChange}
          />
          <label
            htmlFor={`${idPrefix}-big`}
            className="cursor-pointer select-none text-sm font-bold text-[var(--muted)]"
          >
            Set as Big Genre
          </label>
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor={`${idPrefix}-order`}
            className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
          >
            Display Order
          </label>
          <ChunkyInput
            id={`${idPrefix}-order`}
            type="number"
            placeholder="0"
            value={displayOrder}
            onChange={(e) =>
              onDisplayOrderChange(parseInt(e.target.value || '0', 10))
            }
          />
        </div>
      </ChunkyDialogBody>
      <ChunkyDialogFooter>
        <ChunkyButton type="button" variant="outline" onClick={onCancel}>
          Cancel
        </ChunkyButton>
        <ChunkyButton type="submit" variant="primary" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isPending ? submittingLabel : submitLabel}
        </ChunkyButton>
      </ChunkyDialogFooter>
    </>
  );
}
