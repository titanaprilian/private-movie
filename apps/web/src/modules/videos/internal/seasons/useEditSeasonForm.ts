import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateSeason, type SeasonDetails } from '../api';
import { detectProviderFromUrl } from './seasonUtils';
import type { SeasonStatus } from './useAddSeasonForm';

export interface UseEditSeasonFormOptions {
  open: boolean;
  season: SeasonDetails;
  onOpenChange: (open: boolean) => void;
}

export function useEditSeasonForm({
  open,
  season,
  onOpenChange,
}: UseEditSeasonFormOptions) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<SeasonStatus>('completed');
  const [scraperUrl, setScraperUrl] = useState('');
  const [source, setSource] = useState<string>('none');
  const [episodeOffset, setEpisodeOffset] = useState<number>(0);

  useEffect(() => {
    if (open) {
      setTitle(season.title);
      setDescription(season.description ?? '');
      setStatus(
        season.status === 'ongoing' || season.status === 'pending'
          ? season.status
          : 'completed'
      );
      setScraperUrl(season.scraperUrl ?? '');
      setSource(
        season.source ??
          (season.scraperUrl ? detectProviderFromUrl(season.scraperUrl) ?? 'none' : 'none')
      );
      setEpisodeOffset(season.episodeOffset ?? 0);
    }
  }, [open, season]);

  const handleScraperUrlChange = (value: string) => {
    setScraperUrl(value);
    const detected = detectProviderFromUrl(value);
    if (detected) {
      setSource(detected);
    }
  };

  const updateMutation = useMutation({
    mutationFn: (params: {
      title: string;
      description: string | null;
      status: SeasonStatus;
      scraperUrl: string | null;
      source: string | null;
      episodeOffset: number;
    }) => updateSeason(season.id, params),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['series', season.seriesId] });
      toast.success('Season updated successfully', {
        description: updated.title,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update season');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    updateMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      status,
      scraperUrl: scraperUrl.trim() || null,
      source: source === 'none' ? null : source,
      episodeOffset: Number.isFinite(Number(episodeOffset)) ? Number(episodeOffset) : 0,
    });
  };

  return {
    title,
    setTitle,
    description,
    setDescription,
    status,
    setStatus,
    scraperUrl,
    setScraperUrl,
    source,
    setSource,
    episodeOffset,
    setEpisodeOffset,
    handleScraperUrlChange,
    updateMutation,
    handleSubmit,
  };
}
