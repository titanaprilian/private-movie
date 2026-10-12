import type { EditEpisodeDialogProps } from '../types';
export type { EditEpisodeDialogProps } from '../types';
import { useEditEpisodeForm } from '../hooks/useEditEpisodeForm';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyTextarea } from '@/components/ui/chunky-textarea';
import { ChunkyButton } from '@/components/ui/chunky-button';

export function EditEpisodeDialog({
  open,
  onOpenChange,
  episode,
  updateMutation,
}: EditEpisodeDialogProps) {
  const {
    editTitle,
    setEditTitle,
    editDescription,
    setEditDescription,
    editVideoType,
    setEditVideoType,
    handleSubmit,
  } = useEditEpisodeForm({
    open,
    episode,
    updateMutation,
    onOpenChange,
  });

  return (
    <ChunkyDialog open={open} onOpenChange={onOpenChange}>
      <ChunkyDialogContent>
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>Edit Episode</ChunkyDialogTitle>
          <ChunkyDialogDescription>
            Update the details of this episode.
          </ChunkyDialogDescription>
        </ChunkyDialogHeader>
        <ChunkyDialogBody>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="edit-title"
                className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
              >
                Title
              </label>
              <ChunkyInput
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Episode title"
              />
            </div>
            <div>
              <label
                htmlFor="edit-description"
                className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
              >
                Description
              </label>
              <ChunkyTextarea
                id="edit-description"
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Episode description"
              />
            </div>
            <div>
              <label
                htmlFor="edit-video-type"
                className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
              >
                Video Type
              </label>
              <ChunkyInput
                id="edit-video-type"
                value={editVideoType}
                onChange={(e) => setEditVideoType(e.target.value)}
                placeholder="e.g. mp4, embed"
              />
            </div>
            <ChunkyDialogFooter>
              <ChunkyButton
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </ChunkyButton>
              <ChunkyButton type="submit" variant="primary" disabled={updateMutation.isPending}>
                Save Changes
              </ChunkyButton>
            </ChunkyDialogFooter>
          </form>
        </ChunkyDialogBody>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
