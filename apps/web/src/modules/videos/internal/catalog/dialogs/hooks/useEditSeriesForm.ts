import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateSeries } from '../../../api';
import { genresQueryOptions } from '@/modules/genres';
import type { UseEditSeriesFormOptions } from '../../types';
export type { UseEditSeriesFormOptions } from '../../types';

function sameIdList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function useEditSeriesForm({
  open,
  series,
  onOpenChange,
}: UseEditSeriesFormOptions) {
  const queryClient = useQueryClient();
  const { data: genres = [] } = useQuery(genresQueryOptions());

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPosterUrl, setEditPosterUrl] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [logoPreviewError, setLogoPreviewError] = useState(false);
  const [editIsFeatured, setEditIsFeatured] = useState<boolean>(false);
  const [editIsOngoingHighlighted, setEditIsOngoingHighlighted] =
    useState<boolean>(false);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && series) {
      // Only sync text/flag state on the open transition so fresh inline
      // `series` object identities on re-render don't wipe user edits.
      if (!wasOpenRef.current) {
        setEditTitle(series.title ?? '');
        setEditDescription(series.description ?? '');
        setEditPosterUrl(series.posterUrl ?? '');
        setEditLogoUrl(series.logoUrl ?? '');
        setLogoPreviewError(false);
        setEditIsFeatured(Boolean(series.isFeatured));
        setEditIsOngoingHighlighted(Boolean(series.isOngoingHighlighted));
      }

      let initialGenreIds: string[] = [];
      if ('genreIds' in series && series.genreIds && Array.isArray(series.genreIds) && series.genreIds.length > 0) {
        initialGenreIds = series.genreIds;
      } else if ('genres' in series && series.genres && Array.isArray(series.genres)) {
        initialGenreIds = series.genres
          .map((g) => {
            if (typeof g === 'string') {
              const found = genres.find((genre) => genre.id === g || genre.slug === g || genre.name === g);
              return found ? found.id : g;
            }
            return g.id;
          })
          .filter(Boolean);
      }
      setSelectedGenreIds((prev) =>
        sameIdList(prev, initialGenreIds) ? prev : initialGenreIds
      );
    }
    wasOpenRef.current = open;
  }, [open, series, genres]);

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateSeries>[1]) =>
      updateSeries(series.id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success('series.update', {
        description: `Successfully updated ${updated.title}`,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error('series.update', {
        description: `Failed to update series: ${error.message}`,
      });
    },
  });

  const toggleGenre = (genreId: string) => {
    setSelectedGenreIds((prev) =>
      prev.includes(genreId)
        ? prev.filter((id) => id !== genreId)
        : [...prev, genreId]
    );
  };

  const handleLogoUrlChange = (value: string) => {
    setEditLogoUrl(value);
    setLogoPreviewError(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!series) return;
    updateMutation.mutate({
      title: editTitle,
      description: editDescription || null,
      posterUrl: editPosterUrl || null,
      logoUrl: editLogoUrl.trim() === '' ? null : editLogoUrl.trim(),
      isFeatured: editIsFeatured,
      isOngoingHighlighted: editIsOngoingHighlighted,
      genreIds: selectedGenreIds,
    });
  };

  return {
    genres,
    editTitle,
    setEditTitle,
    editDescription,
    setEditDescription,
    editPosterUrl,
    setEditPosterUrl,
    editLogoUrl,
    handleLogoUrlChange,
    logoPreviewError,
    setLogoPreviewError,
    editIsFeatured,
    setEditIsFeatured,
    editIsOngoingHighlighted,
    setEditIsOngoingHighlighted,
    selectedGenreIds,
    toggleGenre,
    updateMutation,
    handleSubmit,
  };
}
