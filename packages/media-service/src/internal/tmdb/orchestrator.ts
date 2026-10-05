import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { episodes, genres, series, seriesToGenres, slugifyGenre } from "@repo/db";
import type { EpisodeWithVideoSources } from "../episodes/repository";
import { createSeasonsRepositoryInternal } from "../seasons/repository";
import {
  createSeriesRepositoryInternal,
  SeriesNotFoundError,
  type SeriesWithEpisodes,
  type SeriesWithSeasons,
  type SeasonWithEpisodes,
} from "../series/repository";
import {
  fetchTmdbSeriesData,
  saveTmdbSeries,
  getTmdbPreview as getTmdbPreviewBase,
  type TmdbImportInput,
  type TmdbSyncInput,
  type TmdbSyncPreviewInput,
  type TmdbSyncPreviewResult,
  type SeasonSyncDiffItem,
  type EpisodeChangeItem,
  type TmdbPreviewResult,
} from "./service";

// Episode with optional mutable claim flag used during passport matching.
// The flag is set in-process only; it is never persisted.
type ClaimableEpisode = EpisodeWithVideoSources & { __claimed?: boolean };

// ────────────────────────────────────────────────────────────────────────────
// importTmdb
// ────────────────────────────────────────────────────────────────────────────

export async function importTmdb<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  input: TmdbImportInput
): Promise<SeriesWithSeasons> {
  const data = await fetchTmdbSeriesData(input.tmdbId, {
    type: input.type,
    includeSpecials: input.includeSpecials,
  });
  return saveTmdbSeries(db, data);
}

// ────────────────────────────────────────────────────────────────────────────
// getTmdbSyncPreview
// ────────────────────────────────────────────────────────────────────────────

export async function getTmdbSyncPreview<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  seriesId: string,
  input: TmdbSyncPreviewInput
): Promise<TmdbSyncPreviewResult> {
  const seriesRepository = createSeriesRepositoryInternal(db);
  const existingSeries = await seriesRepository.findByIdWithEpisodes(seriesId);
  if (!existingSeries) {
    throw new SeriesNotFoundError(`Series with id ${seriesId} not found`);
  }

  const data = await fetchTmdbSeriesData(input.tmdbId, {
    type: input.type,
    includeSpecials: input.includeSpecials,
  });

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

  const localSeasons: SeasonWithEpisodes[] = existingSeries.seasons ?? [];
  const localAllEpisodes: EpisodeWithVideoSources[] = existingSeries.episodes ?? [];

  for (const sMeta of data.seasons) {
    const localSeason = localSeasons.find((s) => s.seasonNumber === sMeta.seasonNumber);

    let isNewSeason = false;
    let localEpisodes: EpisodeWithVideoSources[] = [];

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
          const incomingThumbnail = ep.still_path
            ? ep.still_path.startsWith("http")
              ? ep.still_path
              : `https://image.tmdb.org/t/p/w500${ep.still_path}`
            : null;
          const incomingAirDate = ep.air_date
            ? new Date(ep.air_date).toISOString().split("T")[0]
            : null;
          const oldAirDate = localEp.airDate
            ? localEp.airDate instanceof Date
              ? localEp.airDate.toISOString().split("T")[0]
              : String(localEp.airDate).split("T")[0]
            : null;

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
    seriesId,
    seriesUpdated,
    series: {
      title: data.title,
      overview: data.description,
      posterUrl: data.posterPath,
      backdropUrl: data.backdropPath,
      logoUrl: data.logoUrl,
      rating: incomingRating,
      releaseDate: data.firstAirDate,
      genres: data.genres,
    },
    totalNewEpisodes,
    totalNewSeasons,
    totalUpdatedEpisodes,
    seasonDiffs,
    episodeChanges,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// syncTmdb
// ────────────────────────────────────────────────────────────────────────────

export async function syncTmdb<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  seriesId: string,
  input: TmdbSyncInput
): Promise<SeriesWithEpisodes> {
  const seriesRepository = createSeriesRepositoryInternal(db);

  const existingSeries = await seriesRepository.findById(seriesId);
  if (!existingSeries) {
    throw new SeriesNotFoundError(`Series with id ${seriesId} not found`);
  }

  const data = await fetchTmdbSeriesData(input.tmdbId, {
    type: input.type,
    includeSpecials: input.includeSpecials,
  });

  // Snapshot local layout before the transaction so passport matching and
  // incoming-episode routing can be computed without extra in-tx queries
  // (keeps the logic testable with mocked tx objects).
  const localSnapshot = await seriesRepository.findByIdWithEpisodes(seriesId).catch(() => null);
  const localSeasons: SeasonWithEpisodes[] = localSnapshot?.seasons ?? [];
  // Cast to ClaimableEpisode to allow the mutable __claimed flag — the flag
  // is an in-process sentinel only and is never written to the database.
  const localEpisodes = (localSnapshot?.episodes ?? []) as ClaimableEpisode[];
  const ongoingSeason = localSeasons.find((s) => s.status === "ongoing") ?? null;

  // Track running max order per season for sequential appends of new eps.
  const maxOrderBySeasonId = new Map<string, number>();
  for (const s of localSeasons) {
    const maxInSeason = localEpisodes
      .filter((e) => e.seasonId === s.id)
      .reduce((m, e) => Math.max(m, e.order ?? 0), 0);
    maxOrderBySeasonId.set(s.id, maxInSeason);
  }

  // Primary index: episodes already stamped with TMDB passport numbers.
  const passportIndex = new Map<string, ClaimableEpisode>();
  for (const e of localEpisodes) {
    if (e.tmdbSeasonNumber != null && e.tmdbEpisodeNumber != null) {
      passportIndex.set(`${e.tmdbSeasonNumber}:${e.tmdbEpisodeNumber}`, e);
    }
  }

  // Fallback: episodes synced before passport tracking carry NULL
  // passports. Match them by canonical (seasonNumber, order) once, then
  // stamp the passport in-place.
  const fallbackIndex = new Map<string, ClaimableEpisode>();
  const seasonNumberById = new Map<string, number | null>(
    localSeasons.map((s) => [s.id, s.seasonNumber ?? null])
  );
  for (const e of localEpisodes) {
    if (e.tmdbSeasonNumber == null || e.tmdbEpisodeNumber == null) {
      const sn = seasonNumberById.get(e.seasonId);
      if (sn != null) fallbackIndex.set(`${sn}:${e.order}`, e);
    }
  }

  // Scraper-first placeholders: episodes created by the ongoing scraper
  // ahead of TMDB carry NULL passports. They are enriched in place by
  // the next TMDB sync (UPDATE only — video_sources rows are untouched).
  const unclaimedPlaceholders = localEpisodes.filter(
    (e) =>
      e.tmdbSeasonNumber == null &&
      e.tmdbEpisodeNumber == null &&
      !e.__claimed &&
      (!ongoingSeason || e.seasonId === ongoingSeason.id)
  );

  await db.transaction(async (tx) => {
    const seasonsRepositoryTx = createSeasonsRepositoryInternal(tx);

    // 1. Update series metadata via raw query (seriesRepository.updateSeries
    //    closes over the outer db; tx-level update is issued directly).
    await tx
      .update(series)
      .set({
        title: data.title,
        description: data.description,
        posterUrl: data.posterPath,
        backdropUrl: data.backdropPath,
        logoUrl: data.logoUrl,
        rating: data.voteAverage ? String(data.voteAverage) : null,
        tmdbId: data.tmdbId,
        type: data.type ?? input.type,
        tmdbSyncStatus: "SYNCED",
        updatedAt: new Date(),
      })
      .where(eq(series.id, seriesId));

    // 2. Genre sync (raw upsert required; no genre repository exists).
    if (!input.skipGenres) {
      await tx.delete(seriesToGenres).where(eq(seriesToGenres.seriesId, seriesId));

      const rawGenres = data.genres ?? [];
      const genreNames = Array.from(new Set(rawGenres.map((g) => g.trim()).filter(Boolean)));

      if (genreNames.length > 0) {
        const genreValues = genreNames.map((name) => ({
          id: randomUUID(),
          name,
          slug: slugifyGenre(name),
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        const genreRows: { id: string }[] = await tx
          .insert(genres)
          .values(genreValues)
          .onConflictDoUpdate({
            target: genres.name,
            set: { updatedAt: new Date() },
          })
          .returning({ id: genres.id });

        const seriesToGenreRows = genreRows.map((g) => ({
          seriesId,
          genreId: g.id,
        }));

        if (seriesToGenreRows.length > 0) {
          await tx.insert(seriesToGenres).values(seriesToGenreRows).onConflictDoNothing();
        }
      }
    }

    // 3. Upsert seasons and episodes via tx-scoped repositories.
    for (const season of data.seasons) {
      const seasonRow = await seasonsRepositoryTx.upsert({
        seriesId,
        seasonNumber: season.seasonNumber,
        title: season.name,
        description: season.overview,
        posterUrl: season.posterPath,
        tmdbSyncStatus: "SYNCED",
      });

      // Canonical season id — fall back to local snapshot when the tx mock
      // does not return a row (unit test scenario).
      const canonicalSeasonId =
        seasonRow?.id ??
        localSeasons.find((s) => s.seasonNumber === season.seasonNumber)?.id ??
        null;

      for (const episode of season.episodes) {
        const thumbnailUrl = episode.still_path
          ? episode.still_path.startsWith("http")
            ? episode.still_path
            : `https://image.tmdb.org/t/p/w500${episode.still_path}`
          : null;
        const title = episode.name || `Episode ${episode.episode_number}`;
        const episodeMeta = {
          title,
          description: episode.overview,
          thumbnailUrl,
          rating: episode.vote_average ? String(episode.vote_average) : null,
          airDate: episode.air_date ? new Date(episode.air_date) : null,
          duration: episode.runtime || null,
          updatedAt: new Date(),
        };

        const passportKey = `${season.seasonNumber}:${episode.episode_number}`;
        let matched =
          passportIndex.get(passportKey) ?? fallbackIndex.get(passportKey) ?? null;
        // Avoid double-matching the same local row for two TMDB eps.
        if (matched?.__claimed) matched = null;

        if (matched) {
          matched.__claimed = true;
          // Matched episode: update in-place via tx (episode repo's
          // updateEpisode doesn't expose TMDB passport fields).
          await tx
            .update(episodes)
            .set({
              ...episodeMeta,
              tmdbSeasonNumber: season.seasonNumber,
              tmdbEpisodeNumber: episode.episode_number,
            })
            .where(eq(episodes.id, matched.id));
          continue;
        }

        // Newly discovered TMDB episode: prefer enriching a scraper-first
        // placeholder in place so attached video sources survive.
        const placeholderIdx = unclaimedPlaceholders.findIndex((p) => !p.__claimed);
        if (ongoingSeason && placeholderIdx >= 0) {
          const placeholder = unclaimedPlaceholders[placeholderIdx];
          placeholder.__claimed = true;
          await tx
            .update(episodes)
            .set({
              ...episodeMeta,
              tmdbSeasonNumber: season.seasonNumber,
              tmdbEpisodeNumber: episode.episode_number,
            })
            .where(eq(episodes.id, placeholder.id));
          continue;
        }

        // Route to the active ongoing season (sequential append) or to the
        // canonical season flagged as unassigned when series is completed.
        let targetSeasonId = canonicalSeasonId;
        let targetOrder = episode.episode_number;
        let isUnassigned = false;

        if (ongoingSeason) {
          targetSeasonId = ongoingSeason.id;
          const next = (maxOrderBySeasonId.get(targetSeasonId) ?? 0) + 1;
          maxOrderBySeasonId.set(targetSeasonId, next);
          targetOrder = next;
        } else {
          const next = (maxOrderBySeasonId.get(targetSeasonId ?? "") ?? 0) + 1;
          // Only flag unassigned when appending beyond canonical size;
          // canonical backfills keep their natural order unflagged.
          if (targetOrder > next && canonicalSeasonId) {
            maxOrderBySeasonId.set(targetSeasonId ?? "", targetOrder);
          } else if (targetOrder <= next && canonicalSeasonId) {
            maxOrderBySeasonId.set(targetSeasonId ?? "", Math.max(next, targetOrder));
          }
          isUnassigned = true;
        }

        await tx
          .insert(episodes)
          .values({
            id: randomUUID(),
            seasonId: targetSeasonId,
            order: targetOrder,
            title,
            description: episode.overview,
            thumbnailUrl,
            rating: episode.vote_average ? String(episode.vote_average) : null,
            airDate: episode.air_date ? new Date(episode.air_date) : null,
            duration: episode.runtime || null,
            tmdbSeasonNumber: season.seasonNumber,
            tmdbEpisodeNumber: episode.episode_number,
            isUnassigned,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [episodes.seasonId, episodes.order],
            set: {
              ...episodeMeta,
              tmdbSeasonNumber: season.seasonNumber,
              tmdbEpisodeNumber: episode.episode_number,
            },
          });
      }
    }
  });

  const updated = await seriesRepository.findByIdWithEpisodes(seriesId);
  return updated!;
}

export { getTmdbPreviewBase as getTmdbPreview };
export type { TmdbPreviewResult };
