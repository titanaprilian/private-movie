export function compareSeasons<
  T extends { seasonNumber?: number | null; createdAt?: Date | string | null }
>(a: T, b: T): number {
  const getGroup = (season: T) => {
    const s = season.seasonNumber;
    if (s !== null && s !== undefined && s > 0) return 1;
    if (s === 0) return 2;
    return 3;
  };

  const groupA = getGroup(a);
  const groupB = getGroup(b);

  if (groupA !== groupB) {
    return groupA - groupB;
  }

  if (groupA === 1) {
    const tmdbA = a.seasonNumber!;
    const tmdbB = b.seasonNumber!;
    if (tmdbA !== tmdbB) {
      return tmdbA - tmdbB;
    }
  }

  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return timeA - timeB;
}
