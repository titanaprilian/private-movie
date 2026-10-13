import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchSeriesTmdbPreview,
  fetchSeriesTmdbSyncPreview,
  syncSeriesTmdb,
  type TmdbPreviewResult,
  type TmdbSyncPreviewResult,
} from '../../../api';
import { computeSyncDiff } from '../utils/computeSyncDiff';
import type {
  SeriesDetails,
  UseSyncTmdbOptions,
  UseSyncTmdbReturn,
} from '../../types';

export type { UseSyncTmdbOptions, UseSyncTmdbReturn } from '../../types';

export function useSyncTmdb({
  series,
  isModalOpen,
  onSuccess,
}: UseSyncTmdbOptions): UseSyncTmdbReturn {
  const queryClient = useQueryClient();

  const [includeSpecials, setIncludeSpecials] = useState(false);
  const [tmdbPreviewData, setTmdbPreviewData] = useState<TmdbPreviewResult | null>(null);
  const [syncPreviewData, setSyncPreviewData] = useState<TmdbSyncPreviewResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const seriesType = series.type ?? 'tv';
  const tmdbId = series.tmdbId;

  useEffect(() => {
    if (!isModalOpen) {
      setIncludeSpecials(false);
      setTmdbPreviewData(null);
      setSyncPreviewData(null);
      setPreviewError(null);
      return;
    }

    if (!tmdbId) {
      setTmdbPreviewData(null);
      setSyncPreviewData(null);
      setPreviewError('This series does not have a linked TMDB ID. Please link it in Edit Series first.');
      return;
    }

    let isMounted = true;
    setIsLoadingPreview(true);
    setPreviewError(null);

    // Try detailed sync preview endpoint first, fall back to basic preview endpoint if needed
    fetchSeriesTmdbSyncPreview(series.id, {
      type: seriesType,
      tmdbId,
      includeSpecials,
    })
      .then((syncResult) => {
        if (isMounted) {
          setSyncPreviewData(syncResult);
          setTmdbPreviewData({
            title: syncResult.series?.title || '',
            overview: syncResult.series?.overview || '',
            posterUrl: syncResult.series?.posterUrl || null,
            backdropUrl: syncResult.series?.backdropUrl || null,
            releaseDate: syncResult.series?.releaseDate || null,
            genres: syncResult.series?.genres || [],
            status: syncResult.series?.status || null,
            seasons: (syncResult.seasonDiffs || []).map((s) => ({
              seasonNumber: s.seasonNumber,
              name: s.name,
              episodeCount: s.incomingEpisodeCount,
              posterUrl: null,
            })),
          });
          setIsLoadingPreview(false);
        }
      })
      .catch(() => {
        // Fallback to fetchSeriesTmdbPreview
        fetchSeriesTmdbPreview(seriesType, tmdbId, includeSpecials)
          .then((data) => {
            if (isMounted) {
              setTmdbPreviewData(data);
              setIsLoadingPreview(false);
            }
          })
          .catch((err: Error) => {
            if (isMounted) {
              setPreviewError(err.message || 'Failed to fetch TMDB preview');
              setIsLoadingPreview(false);
            }
          });
      });

    return () => {
      isMounted = false;
    };
  }, [isModalOpen, series.id, seriesType, tmdbId, includeSpecials]);

  const { seasonDiffs, totalNewEpisodes, totalNewSeasons } = useMemo(() => {
    if (syncPreviewData) {
      return {
        seasonDiffs: syncPreviewData.seasonDiffs || [],
        totalNewEpisodes: syncPreviewData.totalNewEpisodes || 0,
        totalNewSeasons: syncPreviewData.totalNewSeasons || 0,
      };
    }
    const computed = computeSyncDiff(series as SeriesDetails, tmdbPreviewData);
    return {
      seasonDiffs: computed?.seasonDiffs || [],
      totalNewEpisodes: computed?.totalNewEpisodes || 0,
      totalNewSeasons: computed?.totalNewSeasons || 0,
    };
  }, [series, tmdbPreviewData, syncPreviewData]);

  const syncMutation = useMutation({
    mutationFn: () => {
      if (!tmdbId) {
        throw new Error('Missing TMDB ID');
      }
      return syncSeriesTmdb(series.id, {
        type: seriesType,
        tmdbId,
        includeSpecials,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', series.id] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      const countText = `+${totalNewEpisodes} new ${totalNewEpisodes === 1 ? 'episode' : 'episodes'}`;
      toast.success(`Series successfully synced with TMDB (${countText})`);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error('Failed to sync with TMDB', {
        description: err.message || 'An unknown error occurred during sync',
      });
    },
  });

  return {
    seriesType,
    tmdbId,
    includeSpecials,
    setIncludeSpecials,
    tmdbPreviewData,
    syncPreviewData,
    isLoadingPreview,
    previewError,
    seasonDiffs,
    totalNewEpisodes,
    totalNewSeasons,
    syncMutation,
  };
}
