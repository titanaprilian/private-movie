import type {
  MediaHomeFeedHero,
  MediaRecentlyAddedEpisode,
  MediaSeriesMetadata,
} from './api';
import type { SeriesItem } from './types';

export const EPISODE_THUMBNAIL_PLACEHOLDER =
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1200&auto=format&fit=crop';

export function episodeBadge(
  seasonNumber: number | null,
  order: number,
): string {
  if (seasonNumber !== null && seasonNumber !== undefined) {
    return `S${seasonNumber} E${order}`;
  }
  return `EP ${order}`;
}

export function resolveEpisodeThumbnail(
  ep: MediaRecentlyAddedEpisode,
): string {
  return (
    ep.thumbnailUrl ||
    ep.series.backdropUrl ||
    ep.series.posterUrl ||
    EPISODE_THUMBNAIL_PLACEHOLDER
  );
}

export function mapSeriesToSeriesItem(s: MediaSeriesMetadata): SeriesItem {
  const genres =
    s.genres && s.genres.length > 0 ? s.genres.map((g) => g.name) : [];
  const year = s.createdAt ? new Date(s.createdAt).getFullYear() : 2026;
  const rawRating = s.rating || (s.type === 'movie' ? '7.5' : '8.0');
  const rating = !isNaN(Number(rawRating))
    ? Number(rawRating).toFixed(1)
    : rawRating;
  const type = (s.type || 'tv').toUpperCase();
  const posterUrl =
    s.posterUrl ||
    s.backdropUrl ||
    'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=800&auto=format&fit=crop';
  const bannerUrl =
    s.backdropUrl ||
    s.posterUrl ||
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1200&auto=format&fit=crop';

  return {
    id: s.id,
    title: s.title,
    synopsis: s.description || 'No description available for this series.',
    posterUrl,
    bannerUrl,
    logoUrl: s.logoUrl ?? null,
    type,
    matchScore: '98% Match',
    year,
    rating,
    seasons: s.seasonsCount ?? 0,
    episodes: s.episodesCount ?? 0,
    subDub: 'SUB | DUB',
    genres,
  };
}

export function mapHeroToSeriesItem(hero: MediaHomeFeedHero): SeriesItem {
  const base = mapSeriesToSeriesItem(hero);
  if (hero.tags && hero.tags.length > 0) {
    return {
      ...base,
      genres: hero.tags,
    };
  }
  return base;
}
