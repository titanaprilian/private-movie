import type { SeriesWithEpisodes } from "../../catalog/repository";
import type {
  EpisodeChangeItem,
  SeasonSyncDiffItem,
  TmdbSeriesFullData,
} from "../types";

function thumbnailFromStill(stillPath: string | null | undefined): string | null {
  if (!stillPath) return null;
  return stillPath.startsWith("http")
    ? stillPath
    : `https://image.tmdb.org/t/p/w500${stillPath}`;
}

function toDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value).split("T")[0];
}

function toIncomingAirDate(airDate: string | null | undefined): string | null {
  if (!airDate) return null;
  return new Date(airDate).toISOString().split("T")[0];
}

export interface SyncDiffResult {
  seriesUpdated: boolean;
  seasonDiffs: SeasonSyncDiffItem[];
  episodeChanges: EpisodeChangeItem[];
  totalNewEpisodes: number;
  totalNewSeasons: number;
  totalUpdatedEpisodes: number;
}

export function computeSyncDiff(
  existingSeries: SeriesWithEpisodes,
  data: TmdbSeriesFullData
): SyncDiffResult {
  const incomingRating = data.voteAverage ? String(data.voteAverage) : null;
  const seriesUpdated =
    (existingSeries.description ?? null) !== (data.description ?? null) ||
    (existingSeries.posterUrl ?? null) !== (data.posterPath ?? null) ||
    (existingSeries.backdropUrl ?? null) !== (data.backdropPath ?? null) ||
    (existingSeries.logoUrl ?? null) !== (data.logoUrl ?? null) ||
    (existingSeries.rating ?? null) !== (incomingRating ?? null) ||
    (existingSeries.title ?? null) !== (data.title ?? null);

  const seasonDiffs: SeasonSyncDiffItem[] = [];
  const episodeChanges: EpisodeChangeItem[] = [];

  const localSeasons = existingSeries.seasons ?? [];
  const localAllEpisodes = existingSeries.episodes ?? [];

  for (const sMeta of data.seasons) {
    const localSeason = localSeasons.find((s) => s.seasonNumber === sMeta.seasonNumber);

    let isNewSeason = false;
    let localEpisodes: typeof localAllEpisodes = [];

    if (localSeason) {
      localEpisodes = localSeason.episodes ?? [];
    } else if (
      localSeasons.length === 0 &&
      sMeta.seasonNumber === 1 &&
      localAllEpisodes.length > 0
    ) {
      localEpisodes = localAllEpisodes;
    } else {
      isNewSeason = true;
    }

    const diff = isNewSeason
      ? sMeta.episodes.length
      : Math.max(0, sMeta.episodes.length - localEpisodes.length);

    let badgeText: string;
    let badgeType: SeasonSyncDiffItem["badgeType"];

    if (isNewSeason) {
      badgeText = `New Season (${sMeta.episodes.length} ${
        sMeta.episodes.length === 1 ? "ep" : "eps"
      })`;
      badgeType = "new-season";
    } else if (diff > 0) {
      badgeText = `+${diff} new ${diff === 1 ? "ep" : "eps"} (${localEpisodes.length} → ${sMeta.episodes.length})`;
      badgeType = "new-eps";
    } else {
      badgeText = `Existing (${localEpisodes.length} ${
        localEpisodes.length === 1 ? "ep" : "eps"
      })`;
      badgeType = "existing";
    }

    seasonDiffs.push({
      seasonNumber: sMeta.seasonNumber,
      name: sMeta.name ?? `Season ${sMeta.seasonNumber}`,
      incomingEpisodeCount: sMeta.episodes.length,
      localEpisodeCount: localEpisodes.length,
      diff,
      isNewSeason,
      badgeText,
      badgeType,
    });

    if (!isNewSeason && localEpisodes.length > 0) {
      for (const ep of sMeta.episodes) {
        const localEp = localEpisodes.find((e) => e.order === ep.episode_number);
        if (localEp) {
          const incomingTitle = ep.name || `Episode ${ep.episode_number}`;
          const incomingOverview = ep.overview ?? null;
          const incomingThumbnail = thumbnailFromStill(ep.still_path);
          const incomingAirDate = toIncomingAirDate(ep.air_date);
          const oldAirDate = toDateOnly(localEp.airDate);

          const titleChanged = (localEp.title ?? "") !== incomingTitle;
          const overviewChanged = (localEp.description ?? null) !== incomingOverview;
          const thumbnailChanged = (localEp.thumbnailUrl ?? null) !== incomingThumbnail;
          const airDateChanged = (oldAirDate ?? null) !== incomingAirDate;

          if (titleChanged || overviewChanged || thumbnailChanged || airDateChanged) {
            episodeChanges.push({
              seasonNumber: sMeta.seasonNumber,
              episodeNumber: ep.episode_number,
              oldTitle: localEp.title,
              newTitle: incomingTitle,
              oldOverview: localEp.description ?? null,
              newOverview: incomingOverview,
              oldThumbnailUrl: localEp.thumbnailUrl ?? null,
              newThumbnailUrl: incomingThumbnail,
              oldAirDate: oldAirDate ?? null,
              newAirDate: incomingAirDate ?? null,
              titleChanged,
              overviewChanged,
              thumbnailChanged,
              airDateChanged,
            });
          }
        }
      }
    }
  }

  const totalNewEpisodes = seasonDiffs.reduce((acc, item) => acc + item.diff, 0);
  const totalNewSeasons = seasonDiffs.filter((item) => item.isNewSeason).length;
  const totalUpdatedEpisodes = episodeChanges.length;

  return {
    seriesUpdated,
    seasonDiffs,
    episodeChanges,
    totalNewEpisodes,
    totalNewSeasons,
    totalUpdatedEpisodes,
  };
}
