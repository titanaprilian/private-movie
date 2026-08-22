import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { episodes, genres, seasons, seriesToGenres } from "./schema";

export function slugifyGenre(name: string): string {
  return name
    .replace(/&/g, "and")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseGenresFromMetadata(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const rawGenres = (metadata as Record<string, unknown>).genres;
  if (!rawGenres) {
    return [];
  }

  const genreStrings: string[] = [];
  if (Array.isArray(rawGenres)) {
    for (const item of rawGenres) {
      if (typeof item === "string" && item.trim().length > 0) {
        genreStrings.push(item.trim());
      }
    }
  } else if (typeof rawGenres === "string" && rawGenres.trim().length > 0) {
    genreStrings.push(rawGenres.trim());
  }

  return genreStrings;
}

export interface ExtractedGenre {
  id: string;
  name: string;
  slug: string;
}

export interface ExtractedSeriesGenreMapping {
  seriesId: string;
  genreSlug: string;
}

export interface ExtractedGenresData {
  genresMap: Map<string, ExtractedGenre>;
  seriesGenreMappings: ExtractedSeriesGenreMapping[];
}

export function extractGenresAndMappings(
  episodesList: Array<{ seriesId: string | null; metadata: unknown }>
): ExtractedGenresData {
  const genresMap = new Map<string, ExtractedGenre>();
  const mappingsSet = new Set<string>();
  const seriesGenreMappings: ExtractedSeriesGenreMapping[] = [];

  for (const ep of episodesList) {
    if (!ep.seriesId) continue;
    const genreNames = parseGenresFromMetadata(ep.metadata);
    for (const name of genreNames) {
      const slug = slugifyGenre(name);
      if (!slug) continue;

      if (!genresMap.has(slug)) {
        genresMap.set(slug, {
          id: randomUUID(),
          name,
          slug,
        });
      }

      const mappingKey = `${ep.seriesId}:${slug}`;
      if (!mappingsSet.has(mappingKey)) {
        mappingsSet.add(mappingKey);
        seriesGenreMappings.push({
          seriesId: ep.seriesId,
          genreSlug: slug,
        });
      }
    }
  }

  return {
    genresMap,
    seriesGenreMappings,
  };
}

export async function migrateGenres(db: any): Promise<{ genresCount: number; mappingsCount: number }> {
  const allEpisodes = await db
    .select({
      seriesId: seasons.seriesId,
      metadata: episodes.metadata,
    })
    .from(episodes)
    .innerJoin(seasons, eq(episodes.seasonId, seasons.id));

  const { genresMap, seriesGenreMappings } = extractGenresAndMappings(allEpisodes);

  if (genresMap.size > 0) {
    const genresList = Array.from(genresMap.values());
    await db
      .insert(genres)
      .values(genresList)
      .onConflictDoNothing({ target: genres.slug });
  }

  const existingGenres = await db
    .select({ id: genres.id, slug: genres.slug })
    .from(genres);

  const slugToGenreIdMap = new Map<string, string>();
  for (const g of existingGenres) {
    slugToGenreIdMap.set(g.slug, g.id);
  }

  const mappingsToInsert = seriesGenreMappings
    .map((m) => {
      const genreId = slugToGenreIdMap.get(m.genreSlug);
      if (!genreId) return null;
      return {
        seriesId: m.seriesId,
        genreId,
      };
    })
    .filter((m): m is { seriesId: string; genreId: string } => m !== null);

  if (mappingsToInsert.length > 0) {
    await db
      .insert(seriesToGenres)
      .values(mappingsToInsert)
      .onConflictDoNothing();
  }

  return {
    genresCount: genresMap.size,
    mappingsCount: mappingsToInsert.length,
  };
}
