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
import type { GenreCreateDialogProps } from '../types';

export function CreateGenreDialog({
  open,
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
}: GenreCreateDialogProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    onError(null);
    mutation.mutate(
      {
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
    <ChunkyDialog open={open} onOpenChange={onOpenChange}>
      <ChunkyDialogContent className="sm:max-w-md">
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>Create New Genre</ChunkyDialogTitle>
          <ChunkyDialogDescription>
            Add a new genre category to the content taxonomy.
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
                htmlFor="create-genre-name"
                className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
              >
                Genre Name
              </label>
              <ChunkyInput
                id="create-genre-name"
                placeholder="e.g. Sci-Fi & Fantasy"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="create-genre-slug"
                className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
              >
                Slug
              </label>
              <ChunkyInput
                id="create-genre-slug"
                placeholder="e.g. sci-fi-and-fantasy"
                value={slug}
                onChange={(e) => onSlugChange(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <ChunkyCheckbox
                id="create-genre-big"
                checked={isBigGenre}
                onCheckedChange={onBigGenreChange}
              />
              <label
                htmlFor="create-genre-big"
                className="cursor-pointer select-none text-sm font-bold text-[var(--muted)]"
              >
                Set as Big Genre
              </label>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="create-genre-order"
                className="mb-1.5 block text-sm font-bold text-[var(--ink)]"
              >
                Display Order
              </label>
              <ChunkyInput
                id="create-genre-order"
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
              {mutation.isPending ? 'Creating...' : 'Create'}
            </ChunkyButton>
          </ChunkyDialogFooter>
        </form>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
