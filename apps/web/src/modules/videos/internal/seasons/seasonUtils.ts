import type { SeasonDetails } from '../api';

type SeasonLike = Pick<SeasonDetails, 'id'> &
  Partial<Pick<SeasonDetails, 'tmdbSeason'>> & {
    seasonNumber?: number | null;
    tmdbSeason?: number | null;
  };

export function getSeasonNumber(
  season: SeasonLike,
  fallbackIndex: number
): number {
  const raw =
    (season as { seasonNumber?: unknown }).seasonNumber ??
    (season as { tmdbSeason?: unknown }).tmdbSeason;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return fallbackIndex + 1;
}

export function getNextSeasonNumber(seasons: SeasonLike[]): number {
  if (seasons.length === 0) return 1;
  const numbers = seasons.map((s, i) => getSeasonNumber(s, i));
  return Math.max(...numbers) + 1;
}

export function detectProviderFromUrl(url: string): 'otakudesu' | 'dramula' | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes('otakudesu')) return 'otakudesu';
  if (lower.includes('dramula')) return 'dramula';
  return null;
}
