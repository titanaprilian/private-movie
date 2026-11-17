import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
} from '@/components/ui/chunky-dialog';
import { GenreFormBody } from './GenreFormBody';
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
          <GenreFormBody
            idPrefix="edit-genre"
            error={error}
            name={name}
            slug={slug}
            isBigGenre={isBigGenre}
            displayOrder={displayOrder}
            onNameChange={onNameChange}
            onSlugChange={onSlugChange}
            onBigGenreChange={onBigGenreChange}
            onDisplayOrderChange={onDisplayOrderChange}
            isPending={mutation.isPending}
            submitLabel="Save Changes"
            submittingLabel="Saving..."
            onCancel={() => onOpenChange(false)}
          />
        </form>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
