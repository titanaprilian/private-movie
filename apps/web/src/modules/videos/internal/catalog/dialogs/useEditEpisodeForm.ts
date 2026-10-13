import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import type { SeriesDetailEpisode, UpdateEpisodeMutation } from '../types';

export interface UseEditEpisodeFormOptions {
  open: boolean;
  episode: SeriesDetailEpisode | null;
  updateMutation: UpdateEpisodeMutation;
  onOpenChange: (open: boolean) => void;
}

export function useEditEpisodeForm({
  open,
  episode,
  updateMutation,
  onOpenChange,
}: UseEditEpisodeFormOptions) {
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVideoType, setEditVideoType] = useState('');

  useEffect(() => {
    if (open && episode) {
      setEditTitle(episode.title ?? '');
      setEditDescription(episode.description ?? '');
      // If the episode has videoSources, or any initial videoType, we can initialize it
      const initialType = (episode as { videoType?: string | null }).videoType ?? '';
      setEditVideoType(initialType);
    }
  }, [open, episode]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!episode) return;
    updateMutation.mutate({
      id: episode.id,
      data: {
        title: editTitle,
        videoType: editVideoType || null,
        description: editDescription || null,
      },
    });
    onOpenChange(false);
  };

  return {
    editTitle,
    setEditTitle,
    editDescription,
    setEditDescription,
    editVideoType,
    setEditVideoType,
    handleSubmit,
  };
}
