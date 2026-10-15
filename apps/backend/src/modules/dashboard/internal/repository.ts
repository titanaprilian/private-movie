import { count, desc, eq } from "drizzle-orm";
import { episodes, genres, seasons, series, storageProviders } from "@repo/db";
import type {
  AdminDashboardCatalogStats,
  AdminDashboardOngoingSeason,
  AdminDashboardRecentSeries,
} from "@repo/contracts";
import { loadSchedulerConfig } from "../../media";
import type {
  DashboardDb,
  DashboardRepository,
  SchedulerConfig,
  StorageProviderLimit,
} from "./types";

export function createDashboardRepository(
  db: DashboardDb,
): DashboardRepository {
  return {
    async getCatalogStats(): Promise<AdminDashboardCatalogStats> {
      const [seriesRow] = await db.select({ value: count() }).from(series);
      const ongoingSeriesCount = await countOngoingSeries(db);
      const [featuredRow] = await db
        .select({ value: count() })
        .from(series)
        .where(eq(series.isFeatured, true));
      const [seasonsRow] = await db.select({ value: count() }).from(seasons);
      const [genresRow] = await db.select({ value: count() }).from(genres);
      const [episodesRow] = await db
        .select({ value: count() })
        .from(episodes)
        .innerJoin(seasons, eq(episodes.seasonId, seasons.id));

      return {
        totalSeries: seriesRow?.value ?? 0,
        ongoingSeriesCount,
        featuredSeriesCount: featuredRow?.value ?? 0,
        totalSeasons: seasonsRow?.value ?? 0,
        totalEpisodes: episodesRow?.value ?? 0,
        totalGenres: genresRow?.value ?? 0,
      };
    },

    async getOngoingSeasons(): Promise<AdminDashboardOngoingSeason[]> {
      // Single grouped join: seasons + series + episodes with
      // count(episodes.id) grouped by season/series, replacing the previous
      // N+1 per-season episode count loop.
      const rows = await db
        .select({
          seasonId: seasons.id,
          seriesId: seasons.seriesId,
          seriesTitle: series.title,
          seasonTitle: seasons.title,
          seasonNumber: seasons.seasonNumber,
          posterUrl: series.posterUrl,
          lastScrapedAt: seasons.lastScrapedAt,
          lastScrapeError: seasons.lastScrapeError,
          episodeCount: count(episodes.id),
        })
        .from(seasons)
        .innerJoin(series, eq(seasons.seriesId, series.id))
        .leftJoin(episodes, eq(episodes.seasonId, seasons.id))
        .where(eq(seasons.status, "ongoing"))
        .groupBy(
          seasons.id,
          seasons.seriesId,
          series.title,
          seasons.title,
          seasons.seasonNumber,
          series.posterUrl,
          seasons.lastScrapedAt,
          seasons.lastScrapeError,
        );
      return rows.map((row) => ({
        seasonId: row.seasonId,
        seriesId: row.seriesId,
        seriesTitle: row.seriesTitle,
        seasonTitle: row.seasonTitle,
        seasonNumber: row.seasonNumber ?? null,
        posterUrl: row.posterUrl ?? null,
        episodeCount: row.episodeCount ?? 0,
        lastScrapedAt: row.lastScrapedAt
          ? row.lastScrapedAt.toISOString()
          : null,
        lastScrapeError: row.lastScrapeError ?? null,
      }));
    },

    async getRecentSeries(): Promise<AdminDashboardRecentSeries[]> {
      // Single grouped query: one roundtrip for the 5 most recent series plus
      // their total episode counts (summed across all seasons).
      const rows = await db
        .select({
          id: series.id,
          title: series.title,
          posterUrl: series.posterUrl,
          updatedAt: series.updatedAt,
          episodeCount: count(episodes.id),
        })
        .from(series)
        .leftJoin(seasons, eq(seasons.seriesId, series.id))
        .leftJoin(episodes, eq(episodes.seasonId, seasons.id))
        .groupBy(series.id, series.title, series.posterUrl, series.updatedAt)
        .orderBy(desc(series.updatedAt))
        .limit(5);
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        posterUrl: row.posterUrl ?? null,
        episodeCount: row.episodeCount ?? 0,
        updatedAt: row.updatedAt.toISOString(),
      }));
    },

    async getStorageProviderLimits(): Promise<StorageProviderLimit[]> {
      const providers = await db
        .select({ storageLimitGb: storageProviders.storageLimitGb })
        .from(storageProviders)
        .where(eq(storageProviders.isEnabled, true));
      return providers.map((p) => ({
        storageLimitGb: p.storageLimitGb ?? null,
      }));
    },

    async getSchedulerConfig(): Promise<SchedulerConfig> {
      return loadSchedulerConfig(db);
    },
  };
}

async function countOngoingSeries(db: DashboardDb): Promise<number> {
  // Domain convention (see seasons repository): a series is "ongoing" when it
  // has at least one season with status = "ongoing", independent of the
  // series-level isOngoingHighlighted curation flag.
  const rows = await db
    .selectDistinct({ seriesId: seasons.seriesId })
    .from(seasons)
    .where(eq(seasons.status, "ongoing"));
  return rows.length;
}
