import { useMemo } from 'react';
import type { LocalEpisodeItem, SeasonGroupOption } from '../../types';

export interface TargetEpisodeOption {
  id: string;
  title: string;
  order?: number;
}

export interface UseTargetEpisodeOptionsResult {
  scopedEpisodes: TargetEpisodeOption[];
  seasonHeading: string | null;
  allEpisodes: TargetEpisodeOption[];
  formatEpisodeLabel: (ep: { title: string; order?: number }) => string;
}

export function formatTargetEpisodeLabel(ep: { title: string; order?: number }): string {
  return `Ep ${ep.order ?? '?'}: ${ep.title}`;
}

function sortByOrder<T extends { order?: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function useTargetEpisodeOptions(
  seasons: SeasonGroupOption[] = [],
  localEpisodes: LocalEpisodeItem[] = [],
  targetSeasonId?: string,
): UseTargetEpisodeOptionsResult {
  const { scopedEpisodes, seasonHeading } = useMemo(() => {
    if (targetSeasonId && seasons.length > 0) {
      const season = seasons.find((s) => s.id === targetSeasonId);
      if (season) {
        return {
          scopedEpisodes: sortByOrder([...(season.episodes ?? [])]),
          seasonHeading:
            season.title ||
            (typeof season.tmdbSeason === 'number' ? `Season ${season.tmdbSeason}` : 'Season'),
        };
      }
    }
    if (targetSeasonId && localEpisodes.length > 0) {
      const filtered = localEpisodes.filter((ep) => ep.seasonId === targetSeasonId);
      if (filtered.length > 0) {
        return {
          scopedEpisodes: sortByOrder(filtered),
          seasonHeading:
            filtered[0].seasonTitle ||
            (typeof filtered[0].seasonNumber === 'number'
              ? `Season ${filtered[0].seasonNumber}`
              : 'Season'),
        };
      }
    }
    if (seasons.length > 0) {
      return {
        scopedEpisodes: sortByOrder(seasons.flatMap((s) => s.episodes ?? [])),
        seasonHeading: null as string | null,
      };
    }
    return {
      scopedEpisodes: sortByOrder(localEpisodes),
      seasonHeading: null as string | null,
    };
  }, [targetSeasonId, seasons, localEpisodes]);

  const allEpisodes = useMemo<TargetEpisodeOption[]>(() => {
    if (seasons.length > 0) return seasons.flatMap((s) => s.episodes ?? []);
    return localEpisodes;
  }, [seasons, localEpisodes]);

  return { scopedEpisodes, seasonHeading, allEpisodes, formatEpisodeLabel: formatTargetEpisodeLabel };
}
