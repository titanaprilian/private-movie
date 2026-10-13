import {
  useEpisodeDetailDrawer,
} from '../hooks/useEpisodeDetailDrawer';
import type { EpisodeDetailDrawerProps } from '../types';
import {
  ChunkyDrawer,
  ChunkyDrawerBody,
  ChunkyDrawerContent,
  ChunkyDrawerDescription,
  ChunkyDrawerFooter,
  ChunkyDrawerHeader,
  ChunkyDrawerTitle,
} from '@/components/ui/chunky-drawer';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyTextarea } from '@/components/ui/chunky-textarea';
import { SourceManagementTable } from '../../sources/SourceManagementTable';

export function EpisodeDetailDrawer({
  open,
  onOpenChange,
  episode,
  onSave,
  isSaving = false,
  onOpenAdvancedIngest,
}: EpisodeDetailDrawerProps) {
  const { formState, updateField, isDirty, handleDiscard, handleSubmit } =
    useEpisodeDetailDrawer({ episode, onSave, isSaving });

  if (!episode) {
    return null;
  }

  return (
    <ChunkyDrawer open={open} onOpenChange={onOpenChange}>
      <ChunkyDrawerContent>
        <ChunkyDrawerHeader>
          <div className="flex items-center gap-2">
            <span className="rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 font-mono text-xs font-extrabold text-[var(--muted)]">
              #{episode.order ?? '—'}
            </span>
            <ChunkyDrawerTitle>{episode.title}</ChunkyDrawerTitle>
          </div>
          <ChunkyDrawerDescription className="font-mono text-[11px]">
            ID: {episode.id}
          </ChunkyDrawerDescription>
        </ChunkyDrawerHeader>

        <ChunkyDrawerBody>
          <form
            id="episode-drawer-form"
            onSubmit={handleSubmit}
            className="space-y-4 py-2"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="drawer-title"
                className="text-sm font-extrabold text-[var(--ink)]"
              >
                Title
              </label>
              <ChunkyInput
                id="drawer-title"
                value={formState.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Episode title"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="drawer-description"
                className="text-sm font-extrabold text-[var(--ink)]"
              >
                Description
              </label>
              <ChunkyTextarea
                id="drawer-description"
                rows={4}
                value={formState.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Episode description..."
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="drawer-duration"
                className="text-sm font-extrabold text-[var(--ink)]"
              >
                Duration
              </label>
              <ChunkyInput
                id="drawer-duration"
                value={formState.duration}
                onChange={(e) => updateField('duration', e.target.value)}
                placeholder="e.g. 24:15 or 01:20:00"
              />
            </div>

            <div className="pt-2">
              <SourceManagementTable
                episode={episode}
                onOpenAdvancedIngest={onOpenAdvancedIngest}
              />
            </div>
          </form>
        </ChunkyDrawerBody>

        <ChunkyDrawerFooter className="sm:justify-between">
          <div className="text-[11px] font-semibold text-[var(--muted)]">
            {isDirty ? (
              <span className="font-extrabold text-[var(--gold-dark)]">
                ● Unsaved changes
              </span>
            ) : (
              <span>All changes saved</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ChunkyButton
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              disabled={!isDirty || isSaving}
            >
              Discard
            </ChunkyButton>
            <ChunkyButton
              type="submit"
              form="episode-drawer-form"
              size="sm"
              disabled={!isDirty || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </ChunkyButton>
          </div>
        </ChunkyDrawerFooter>
      </ChunkyDrawerContent>
    </ChunkyDrawer>
  );
}
