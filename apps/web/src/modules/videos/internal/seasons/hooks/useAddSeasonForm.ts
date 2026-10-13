import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createSeason } from '../../api';
import { getNextSeasonNumber, detectProviderFromUrl } from '../utils/seasonUtils';
import type { SeasonStatus, UseAddSeasonFormOptions } from '../types';

export function useAddSeasonForm({
  open,
  seriesId,
  seasons,
  onOpenChange,
}: UseAddSeasonFormOptions) {
  const queryClient = useQueryClient();
  const nextSeasonNumber = getNextSeasonNumber(seasons);

  const [seasonNumber, setSeasonNumber] = useState(nextSeasonNumber);
  const [title, setTitle] = useState(`Season ${nextSeasonNumber}`);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<SeasonStatus>('completed');
  const [scraperUrl, setScraperUrl] = useState('');
  const [source, setSource] = useState<string>('none');
  const [episodeOffset, setEpisodeOffset] = useState<number>(0);
  const [titleTouched, setTitleTouched] = useState(false);

  useEffect(() => {
    if (open) {
      const next = getNextSeasonNumber(seasons);
      setSeasonNumber(next);
      setTitle(`Season ${next}`);
      setTitleTouched(false);
      setDescription('');
      setStatus('completed');
      setScraperUrl('');
      setSource('none');
      setEpisodeOffset(0);
    }
  }, [open, seasons]);

  const handleSeasonNumberChange = (value: number) => {
    setSeasonNumber(value);
    if (!titleTouched && Number.isFinite(value)) {
      setTitle(`Season ${value}`);
    }
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setTitleTouched(true);
  };

  const handleScraperUrlChange = (value: string) => {
    setScraperUrl(value);
    const detected = detectProviderFromUrl(value);
    if (detected) {
      setSource(detected);
    }
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createSeason(seriesId, {
        title: title.trim(),
        seasonNumber,
        description: description.trim() || null,
        status,
        scraperUrl: scraperUrl.trim() || null,
        source: source === 'none' ? null : source,
        episodeOffset: Number.isFinite(Number(episodeOffset)) ? Number(episodeOffset) : 0,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success('Season created successfully', {
        description: created.title,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create season');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!Number.isInteger(seasonNumber) || seasonNumber < 0) return;
    createMutation.mutate();
  };

  const isValid =
    title.trim().length > 0 &&
    Number.isInteger(seasonNumber) &&
    seasonNumber >= 0;

  return {
    seasonNumber,
    setSeasonNumber,
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
    titleTouched,
    handleSeasonNumberChange,
    handleTitleChange,
    handleScraperUrlChange,
    createMutation,
    handleSubmit,
    isValid,
  };
}
