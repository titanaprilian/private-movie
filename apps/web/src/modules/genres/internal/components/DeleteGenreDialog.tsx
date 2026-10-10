import { ChunkyConfirmDialog } from '@/components/ui/chunky-confirm-dialog';
import type { GenreDeleteDialogProps } from '../types';

export function DeleteGenreDialog({
  genre,
  onOpenChange,
  error,
  mutation,
  onSuccess,
  onError,
}: GenreDeleteDialogProps) {
  const handleConfirm = () => {
    if (!genre) return;
    onError(null);
    mutation.mutate(genre.id, {
      onSuccess,
      onError: (err: Error) => {
        onError(err.message);
      },
    });
  };

  return (
    <ChunkyConfirmDialog
      open={Boolean(genre)}
      onOpenChange={onOpenChange}
      title="Delete Genre"
      description={
        <>
          Are you sure you want to delete &quot;{genre?.name}&quot;? This
          action cannot be undone.
          {error && (
            <span className="mt-2 block rounded-2xl border-2 border-[var(--red-dark)] bg-[var(--red)]/10 px-4 py-3 font-sans text-xs font-bold text-[var(--red)]">
              {error}
            </span>
          )}
        </>
      }
      confirmLabel="Delete"
      cancelLabel="Cancel"
      confirmVariant="danger"
      isPending={mutation.isPending}
      onConfirm={handleConfirm}
    />
  );
}
