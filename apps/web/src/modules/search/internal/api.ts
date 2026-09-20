import { queryOptions } from '@tanstack/react-query';
import { fetchSeries } from '@/modules/videos';

export function seriesSearchQueryOptions(query: string, genre?: string, limit: number = 5) {
  const trimmed = query.trim();
  return queryOptions({
    queryKey: ['series', 'search', trimmed, genre, limit],
    queryFn: () => fetchSeries({ q: trimmed, genre, limit }),
    enabled: trimmed.length > 0,
  });
}
