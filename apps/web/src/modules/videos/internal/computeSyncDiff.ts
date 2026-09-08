import type {
  SeriesDetails,
  TmdbPreviewResult,
  TmdbPreviewSeason,
} from './api';

export interface SeasonDiffItem {
  seasonNumber: number;
  name: string;
  incomingEpisodeCount: number;
  localEpisodeCount: number;
  diff: number;
  isNewSeason: boolean;
  badgeText: string;
  badgeType: 'existing' | 'new-eps' | 'new-season';
}

export function computeSyncDiff(
  series: SeriesDetails,
  tmdbPreview: TmdbPreviewResult | null
): {
  seasonDiffs: SeasonDiffItem[];
  totalNewEpisodes: number;
  totalNewSeasons: number;
} {
  if (!tmdbPreview) {
    return {
      seasonDiffs: [],
      totalNewEpisodes: 0,
      totalNewSeasons: 0,
    };
  }

  const isMovie = (series.type ?? 'tv') === 'movie';

  if (isMovie) {
    const localEpisodeCount = series.episodes?.length ?? 0;
    const incomingEpisodeCount = 1;
    const diff = Math.max(0, incomingEpisodeCount - localEpisodeCount);
    const isNew = localEpisodeCount === 0;

    const badgeText = isNew
      ? `New (${incomingEpisodeCount} ep)`
      : `Existing (${localEpisodeCount} eps)`;
    const badgeType: SeasonDiffItem['badgeType'] = isNew ? 'new-season' : 'existing';

    return {
      seasonDiffs: [
        {
          seasonNumber: 1,
          name: tmdbPreview.title || 'Movie',
          incomingEpisodeCount,
          localEpisodeCount,
          diff,
          isNewSeason: isNew,
          badgeText,
          badgeType,
        },
      ],
      totalNewEpisodes: diff,
      totalNewSeasons: 0,
    };
  }

  const incomingSeasons: TmdbPreviewSeason[] = tmdbPreview.seasons ?? [];
  const localSeasons = series.seasons ?? [];
  const localEpisodes = series.episodes ?? [];

  const seasonDiffs: SeasonDiffItem[] = incomingSeasons.map((season) => {
    // Attempt to match local season by tmdbSeason number or title
    let localSeason = localSeasons.find(
      (s) => s.tmdbSeason === season.seasonNumber
    );

    if (!localSeason) {
      localSeason = localSeasons.find(
        (s) =>
          s.tmdbSeason == null &&
          (s.title?.toLowerCase() === season.name?.toLowerCase() ||
            s.title?.toLowerCase() === `season ${season.seasonNumber}`.toLowerCase())
      );
    }

    let localEpisodeCount = 0;
    let isNewSeason = false;

    if (localSeason) {
      localEpisodeCount =
        localSeason.episodes?.length ??
        localEpisodes.filter((e) => e.seasonId === localSeason!.id).length;
    } else if (localSeasons.length === 0 && season.seasonNumber === 1 && localEpisodes.length > 0) {
      // Single-season series without explicit season records
      localEpisodeCount = localEpisodes.length;
    } else {
      isNewSeason = true;
    }

    const diff = isNewSeason
      ? season.episodeCount
      : Math.max(0, season.episodeCount - localEpisodeCount);

    let badgeText = '';
    let badgeType: SeasonDiffItem['badgeType'] = 'existing';

    if (isNewSeason) {
      badgeText = `New Season (${season.episodeCount} ${
        season.episodeCount === 1 ? 'ep' : 'eps'
      })`;
      badgeType = 'new-season';
    } else if (diff > 0) {
      badgeText = `+${diff} new ${diff === 1 ? 'ep' : 'eps'} (${localEpisodeCount} → ${season.episodeCount})`;
      badgeType = 'new-eps';
    } else {
      badgeText = `Existing (${localEpisodeCount} ${
        localEpisodeCount === 1 ? 'ep' : 'eps'
      })`;
      badgeType = 'existing';
    }

    return {
      seasonNumber: season.seasonNumber,
      name: season.name || `Season ${season.seasonNumber}`,
      incomingEpisodeCount: season.episodeCount,
      localEpisodeCount,
      diff,
      isNewSeason,
      badgeText,
      badgeType,
    };
  });

  const totalNewEpisodes = seasonDiffs.reduce((acc, item) => acc + item.diff, 0);
  const totalNewSeasons = seasonDiffs.filter((item) => item.isNewSeason).length;

  return {
    seasonDiffs,
    totalNewEpisodes,
    totalNewSeasons,
  };
}
