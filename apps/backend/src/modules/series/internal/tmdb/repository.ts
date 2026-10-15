import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import {
  episodes,
  genres,
  seasons,
  series,
  seriesToGenres,
  slugifyGenre,
  type DbClient,
  type EpisodeRow,
  type SeriesRow,
} from "@repo/db";
import { createSeriesRepository } from "../catalog/repository";
import type {
  TmdbRepository,
  TmdbSeriesFullData,
} from "./types";
import type { SeriesWithSeasons } from "../catalog/repository";

type DbTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

type ClaimableEpisode = EpisodeRow & { __claimed?: boolean };

interface SeasonUpsertInput {
  seriesId: string;
  seasonNumber: number;
  title: string;
  description: string | null;
  posterUrl: string | null;
}

async function upsertSeason(tx: DbTransaction, input: SeasonUpsertInput): Promise<{ id: string }> {
  const now = new Date();
  const [row] = await tx
    .insert(seasons)
    .values({
      id: randomUUID(),
      seriesId: input.seriesId,
      title: input.title,
      description: input.description,
      posterUrl: input.posterUrl,
      seasonNumber: input.seasonNumber,
      tmdbSyncStatus: "SYNCED",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [seasons.seriesId, seasons.seasonNumber],
      set: {
        seriesId: input.seriesId,
        title: input.title,
        description: input.description,
        posterUrl: input.posterUrl,
        tmdbSyncStatus: "SYNCED",
        updatedAt: now,
      },
    })
    .returning({ id: seasons.id });
  return row;
}

async function syncGenres(
  tx: DbTransaction,
  seriesId: string,
  rawGenres: string[]
): Promise<void> {
  await tx.delete(seriesToGenres).where(eq(seriesToGenres.seriesId, seriesId));

  const genreNames = Array.from(new Set(rawGenres.map((g) => g.trim()).filter(Boolean)));
  if (genreNames.length === 0) return;

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

function thumbnailFromStill(stillPath: string | null | undefined): string | null {
  if (!stillPath) return null;
  return stillPath.startsWith("http") ? stillPath : `https://image.tmdb.org/t/p/w500${stillPath}`;
}

export function createTmdbRepository(db: DbClient): TmdbRepository {
  const catalogRepository = createSeriesRepository(db);

  return {
    async findById(id: string) {
      return catalogRepository.findById(id);
    },

    async findByTmdbId(tmdbId: number) {
      return catalogRepository.findByTmdbId(tmdbId);
    },

    async findByIdWithEpisodes(id: string) {
      return catalogRepository.findByIdWithEpisodes(id);
    },

    async saveTmdbSeries(data: TmdbSeriesFullData): Promise<SeriesWithSeasons> {
      const createdId: { id: string | null } = { id: null };

      await db.transaction(async (tx) => {
        const [seriesRow] = await tx
          .insert(series)
          .values({
            id: randomUUID(),
            title: data.title,
            description: data.description,
            posterUrl: data.posterPath,
            backdropUrl: data.backdropPath,
            logoUrl: data.logoUrl,
            rating: data.voteAverage ? String(data.voteAverage) : null,
            tmdbId: data.tmdbId,
            type: data.type ?? "tv",
            createdAt: new Date(),
            updatedAt: new Date(),
            tmdbSyncStatus: "SYNCED",
          })
          .onConflictDoUpdate({
            target: series.tmdbId,
            set: {
              title: data.title,
              description: data.description,
              type: data.type ?? "tv",
              posterUrl: data.posterPath,
              backdropUrl: data.backdropPath,
              logoUrl: data.logoUrl,
              rating: data.voteAverage ? String(data.voteAverage) : null,
              updatedAt: new Date(),
              tmdbSyncStatus: "SYNCED",
            },
          })
          .returning();

        createdId.id = seriesRow.id;

        await syncGenres(tx, seriesRow.id, data.genres || []);

        for (const season of data.seasons) {
          const seasonRow = await upsertSeason(tx, {
            seriesId: seriesRow.id,
            seasonNumber: season.seasonNumber,
            title: season.name,
            description: season.overview,
            posterUrl: season.posterPath,
          });

          for (const episode of season.episodes) {
            const thumbnailUrl = thumbnailFromStill(episode.still_path);

            await tx
              .insert(episodes)
              .values({
                id: randomUUID(),
                seasonId: seasonRow.id,
                order: episode.episode_number,
                title: episode.name || `Episode ${episode.episode_number}`,
                description: episode.overview,
                thumbnailUrl,
                rating: episode.vote_average ? String(episode.vote_average) : null,
                airDate: episode.air_date ? new Date(episode.air_date) : null,
                duration: episode.runtime || null,
                tmdbSeasonNumber: season.seasonNumber,
                tmdbEpisodeNumber: episode.episode_number,
                isUnassigned: false,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [episodes.seasonId, episodes.order],
                set: {
                  title: episode.name || `Episode ${episode.episode_number}`,
                  description: episode.overview,
                  thumbnailUrl,
                  rating: episode.vote_average ? String(episode.vote_average) : null,
                  airDate: episode.air_date ? new Date(episode.air_date) : null,
                  duration: episode.runtime || null,
                  tmdbSeasonNumber: season.seasonNumber,
                  tmdbEpisodeNumber: episode.episode_number,
                  updatedAt: new Date(),
                },
              });
          }
        }
      });

      const createdSeriesRow: SeriesRow | null = createdId.id
        ? await catalogRepository.findById(createdId.id).catch(() => null)
        : null;
      const childSeasons = createdId.id
        ? await db
            .select()
            .from(seasons)
            .where(eq(seasons.seriesId, createdId.id))
            .orderBy(asc(seasons.createdAt))
            .catch(() => [])
        : [];

      return {
        ...(createdSeriesRow ?? {}),
        seasons: childSeasons ?? [],
      } as SeriesWithSeasons;
    },

    async syncTmdbSeries(
      seriesId: string,
      data: TmdbSeriesFullData,
      options?: { skipGenres?: boolean; type?: "tv" | "movie" }
    ): Promise<void> {
      const localSnapshot = await catalogRepository.findByIdWithEpisodes(seriesId).catch(() => null);
      const localSeasons = localSnapshot?.seasons ?? [];
      const localEpisodes = ((localSnapshot?.episodes ?? []) as ClaimableEpisode[]);
      const ongoingSeason = localSeasons.find((s) => s.status === "ongoing") ?? null;

      const maxOrderBySeasonId = new Map<string, number>();
      for (const s of localSeasons) {
        const maxInSeason = localEpisodes
          .filter((e) => e.seasonId === s.id)
          .reduce((m, e) => Math.max(m, e.order ?? 0), 0);
        maxOrderBySeasonId.set(s.id, maxInSeason);
      }

      const passportIndex = new Map<string, ClaimableEpisode>();
      for (const e of localEpisodes) {
        if (e.tmdbSeasonNumber != null && e.tmdbEpisodeNumber != null) {
          passportIndex.set(`${e.tmdbSeasonNumber}:${e.tmdbEpisodeNumber}`, e);
        }
      }

      const seasonNumberById = new Map<string, number | null>(
        localSeasons.map((s) => [s.id, s.seasonNumber ?? null])
      );
      const fallbackIndex = new Map<string, ClaimableEpisode>();
      for (const e of localEpisodes) {
        if (e.tmdbSeasonNumber == null || e.tmdbEpisodeNumber == null) {
          const sn = seasonNumberById.get(e.seasonId);
          if (sn != null) fallbackIndex.set(`${sn}:${e.order}`, e);
        }
      }

      const unclaimedPlaceholders = localEpisodes.filter(
        (e) =>
          e.tmdbSeasonNumber == null &&
          e.tmdbEpisodeNumber == null &&
          !e.__claimed &&
          (!ongoingSeason || e.seasonId === ongoingSeason.id)
      );

      await db.transaction(async (tx) => {
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
            type: data.type ?? options?.type ?? "tv",
            tmdbSyncStatus: "SYNCED",
            updatedAt: new Date(),
          })
          .where(eq(series.id, seriesId));

        if (!options?.skipGenres) {
          await syncGenres(tx, seriesId, data.genres ?? []);
        }

        for (const season of data.seasons) {
          const seasonRow = await upsertSeason(tx, {
            seriesId,
            seasonNumber: season.seasonNumber,
            title: season.name,
            description: season.overview,
            posterUrl: season.posterPath,
          });

          const canonicalSeasonId =
            seasonRow?.id ??
            localSeasons.find((s) => s.seasonNumber === season.seasonNumber)?.id ??
            null;

          for (const episode of season.episodes) {
            const thumbnailUrl = thumbnailFromStill(episode.still_path);
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
            if (matched?.__claimed) matched = null;

            if (matched) {
              matched.__claimed = true;
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
    },
  };
}

export type TmdbRepositoryClient = ReturnType<typeof createTmdbRepository>;
