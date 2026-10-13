import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { SeriesDetails, UpdateEpisodeData } from '../api';

export type EpisodeDrawerEpisode = SeriesDetails['episodes'][number];

export interface EpisodeDrawerFormState {
  title: string;
  description: string;
  duration: string;
}

export interface UseEpisodeDetailDrawerOptions {
  episode: EpisodeDrawerEpisode | null;
  onSave: (episodeId: string, data: UpdateEpisodeData) => Promise<void> | void;
  isSaving?: boolean;
}

export function getEpisodeDrawerInitialState(
  episode: EpisodeDrawerEpisode | null
): EpisodeDrawerFormState {
  return {
    title: episode?.title ?? '',
    description: episode?.description ?? '',
    duration:
      episode?.duration !== null && episode?.duration !== undefined
        ? String(episode.duration)
        : '',
  };
}

export function useEpisodeDetailDrawer({
  episode,
  onSave,
  isSaving = false,
}: UseEpisodeDetailDrawerOptions) {
  const [formState, setFormState] = useState<EpisodeDrawerFormState>(() =>
    getEpisodeDrawerInitialState(episode)
  );

  useEffect(() => {
    setFormState(getEpisodeDrawerInitialState(episode));
  }, [episode]);

  const initialFormState = useMemo(
    () => getEpisodeDrawerInitialState(episode),
    [episode]
  );

  const isDirty = useMemo(() => {
    return (
      formState.title !== initialFormState.title ||
      formState.description !== initialFormState.description ||
      formState.duration !== initialFormState.duration
    );
  }, [formState, initialFormState]);

  const updateField = (field: keyof EpisodeDrawerFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleDiscard = () => {
    setFormState(getEpisodeDrawerInitialState(episode));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!episode || !isDirty || isSaving) return;

    const updateData: UpdateEpisodeData = {
      title: formState.title,
      description: formState.description || null,
      duration: formState.duration || null,
    };

    await onSave(episode.id, updateData);
  };

  return {
    formState,
    setFormState,
    updateField,
    initialFormState,
    isDirty,
    handleDiscard,
    handleSubmit,
  };
}
