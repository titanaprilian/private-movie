import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { api } from '@/lib/api';

const formSchema = z.object({
  type: z.enum(['movie', 'tv']),
  tmdbId: z.number().min(1, 'TMDB ID is required'),
  season: z.number().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface TmdbPreviewData {
  title: string;
  posterUrl: string | null;
  overview: string;
}

async function fetchTmdbPreview(seriesId: string, type: 'movie'|'tv', tmdbId: number, season?: number) {
  const query: any = { type, tmdbId };
  if (type === 'tv' && season !== undefined && !isNaN(season)) {
    query.season = season;
  }
  const result: any = await api.series[seriesId]['tmdb-preview'].get({ $query: query });
  
  if (result.error) {
    throw new Error(result.error.value?.message || 'Failed to fetch TMDB preview');
  }
  return result.data?.data as TmdbPreviewData;
}

async function matchTmdb(seriesId: string, type: 'movie'|'tv', tmdbId: number, season?: number, localSeasonId?: string) {
  const payload: any = { type, tmdbId };
  if (type === 'tv' && season !== undefined && !isNaN(season)) {
    payload.season = season;
    if (localSeasonId) {
      payload.localSeasonId = localSeasonId;
    }
  }
  const result: any = await api.series[seriesId]['tmdb-match'].post(payload);
  
  if (result.error) {
    throw new Error(result.error.value?.message || 'Failed to match TMDB');
  }
  return result.data?.data;
}

export interface TmdbMatchModalProps {
  seriesId: string;
  defaultType?: 'movie' | 'tv';
  defaultSeason?: number;
  localSeasonId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TmdbMatchModal({
  seriesId,
  defaultType = 'movie',
  defaultSeason = 1,
  localSeasonId,
  open,
  onOpenChange,
}: TmdbMatchModalProps) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<TmdbPreviewData | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: defaultType,
      season: defaultSeason,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        type: defaultType,
        season: defaultSeason,
      });
      setPreview(null);
    }
  }, [open, defaultType, defaultSeason, reset]);

  const watchType = watch('type');
  const watchTmdbId = watch('tmdbId');
  const watchSeason = watch('season');

  const { refetch: loadPreview, isFetching: isPreviewLoading } = useQuery({
    queryKey: ['tmdbPreview', seriesId, watchType, watchTmdbId, watchSeason],
    queryFn: () => fetchTmdbPreview(seriesId, watchType, watchTmdbId, watchSeason),
    enabled: false,
  });

  const { mutate: saveMatch, isPending: isSaving } = useMutation({
    mutationFn: (data: FormData) => matchTmdb(seriesId, data.type, data.tmdbId, data.season, localSeasonId),
    onSuccess: () => {
      toast.success('Successfully matched with TMDB');
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      onOpenChange(false);
      setPreview(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error saving match');
    },
  });

  const handlePreview = async () => {
    if (!watchTmdbId || isNaN(watchTmdbId)) return;
    try {
      const { data } = await loadPreview();
      if (data) {
        setPreview(data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Preview fetch failed');
    }
  };

  const onSubmit = (data: FormData) => {
    saveMatch(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Match TMDB</DialogTitle>
          <DialogDescription>
            Manually match this series with TMDB to overwrite local metadata.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                {...register('type')}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="movie">Movie</option>
                <option value="tv">TV Show</option>
              </select>
              {errors.type && <p className="text-red-500 text-xs">{errors.type.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tmdbId">TMDB ID</Label>
              <Input
                id="tmdbId"
                type="number"
                {...register('tmdbId', { valueAsNumber: true })}
                placeholder="e.g. 12345"
              />
              {errors.tmdbId && <p className="text-red-500 text-xs">{errors.tmdbId.message}</p>}
            </div>

            {watchType === 'tv' && (
              <div className="space-y-2">
                <Label htmlFor="season">Season Number (Optional)</Label>
                <Input
                  id="season"
                  type="number"
                  {...register('season', { valueAsNumber: true })}
                  placeholder="e.g. 1"
                />
                {errors.season && <p className="text-red-500 text-xs">{errors.season.message}</p>}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handlePreview} disabled={isPreviewLoading}>
              {isPreviewLoading ? 'Loading...' : 'Preview'}
            </Button>
          </div>

          {preview && (
            <div className="mt-4 p-4 border rounded-md bg-muted/50 flex gap-4">
              {preview.posterUrl && (
                <img src={preview.posterUrl} alt="Poster" className="w-24 h-36 object-cover rounded shadow" />
              )}
              <div className="flex-1 overflow-hidden">
                <h4 className="font-semibold text-lg line-clamp-1">{preview.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-4">{preview.overview}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !preview}>
              {isSaving ? 'Saving...' : 'Save Match'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
