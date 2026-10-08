import { useState, useEffect, useMemo } from 'react';
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
import type { SeriesDetails, UpdateEpisodeData } from '../api';
import { SourceManagementTable } from '../sources/SourceManagementTable';

export type Episode = SeriesDetails['episodes'][number];

export interface EpisodeDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episode: Episode | null;
  onSave: (episodeId: string, data: UpdateEpisodeData) => Promise<void> | void;
  isSaving?: boolean;
  onOpenAdvancedIngest?: (tab: 'remote-ingest' | 'upload-s3') => void;
}

interface FormState {
  title: string;
  description: string;
  duration: string;
}

function getInitialFormState(episode: Episode | null): FormState {
  return {
    title: episode?.title ?? '',
    description: episode?.description ?? '',
    duration:
      episode?.duration !== null && episode?.duration !== undefined
        ? String(episode.duration)
        : '',
  };
}

export function EpisodeDetailDrawer({
  open,
  onOpenChange,
  episode,
  onSave,
  isSaving = false,
  onOpenAdvancedIngest,
}: EpisodeDetailDrawerProps) {
  const [formState, setFormState] = useState<FormState>(() =>
    getInitialFormState(episode)
  );

  useEffect(() => {
    setFormState(getInitialFormState(episode));
  }, [episode]);

  const initialFormState = useMemo(
    () => getInitialFormState(episode),
    [episode]
  );

  const isDirty = useMemo(() => {
    return (
      formState.title !== initialFormState.title ||
      formState.description !== initialFormState.description ||
      formState.duration !== initialFormState.duration
    );
  }, [formState, initialFormState]);

  if (!episode) {
    return null;
  }

  const handleDiscard = () => {
    setFormState(getInitialFormState(episode));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty || isSaving) return;

    const updateData: UpdateEpisodeData = {
      title: formState.title,
      description: formState.description || null,
      duration: formState.duration || null,
    };

    await onSave(episode.id, updateData);
  };

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
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, title: e.target.value }))
                }
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
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
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
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    duration: e.target.value,
                  }))
                }
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
