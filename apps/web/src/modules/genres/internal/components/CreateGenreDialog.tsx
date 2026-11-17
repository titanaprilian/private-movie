import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
} from '@/components/ui/chunky-dialog';
import { GenreFormBody } from './GenreFormBody';
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
          <GenreFormBody
            idPrefix="create-genre"
            error={error}
            name={name}
            slug={slug}
            isBigGenre={isBigGenre}
            displayOrder={displayOrder}
            namePlaceholder="e.g. Sci-Fi & Fantasy"
            slugPlaceholder="e.g. sci-fi-and-fantasy"
            onNameChange={onNameChange}
            onSlugChange={onSlugChange}
            onBigGenreChange={onBigGenreChange}
            onDisplayOrderChange={onDisplayOrderChange}
            isPending={mutation.isPending}
            submitLabel="Create"
            submittingLabel="Creating..."
            onCancel={() => onOpenChange(false)}
          />
        </form>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
