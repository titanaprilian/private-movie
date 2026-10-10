import { Loader2 } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import type { GenreEditDialogProps } from '../types';

export function EditGenreDialog({
  genre,
  onOpenChange,
  name,
  slug,
  isBigGenre,
  displayOrder,
  error,
  mutation,
  onNameChange,
  onSlugChange,
  onBigGenreChange,
  onDisplayOrderChange,
  onSuccess,
  onError,
}: GenreEditDialogProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!genre || !name.trim() || !slug.trim()) return;
    onError(null);
    mutation.mutate(
      {
        id: genre.id,
        name: name.trim(),
        slug: slug.trim(),
        isBigGenre,
        displayOrder,
      },
      {
        onSuccess,
        onError: (err: Error) => {
          onError(err.message);
        },
      }
    );
  };

  return (
    <ChunkyDialog open={Boolean(genre)} onOpenChange={onOpenChange}>
      <ChunkyDialogContent className="sm:max-w-md">
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>Edit Genre</ChunkyDialogTitle>
          <ChunkyDialogDescription>
            Update the name, URL slug, or Big Genre settings for this genre.
          </ChunkyDialogDescription>
        </ChunkyDialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <ChunkyDialogBody className="space-y-4">
            {error && (
              <div className="rounded-2xl border-2 border-[var(--red-dark)] bg-[var(--red)]/10 px-4 py-3 font-sans text-xs font-bold text-[var(--red)]">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label
                htmlFor="edit-genre-name"
                className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
              >
                Genre Name
              </label>
              <ChunkyInput
                id="edit-genre-name"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="edit-genre-slug"
                className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
              >
                Slug
              </label>
              <ChunkyInput
                id="edit-genre-slug"
                value={slug}
                onChange={(e) => onSlugChange(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <ChunkyCheckbox
                id="edit-genre-big"
                checked={isBigGenre}
                onCheckedChange={onBigGenreChange}
              />
              <label
                htmlFor="edit-genre-big"
                className="cursor-pointer select-none text-sm font-bold text-[var(--muted)]"
              >
                Set as Big Genre
              </label>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="edit-genre-order"
                className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
              >
                Display Order
              </label>
              <ChunkyInput
                id="edit-genre-order"
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
            <ChunkyButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ChunkyButton>
            <ChunkyButton
              type="submit"
              variant="primary"
              disabled={mutation.isPending}
            >
              {mutation.isPending && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </ChunkyButton>
          </ChunkyDialogFooter>
        </form>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
