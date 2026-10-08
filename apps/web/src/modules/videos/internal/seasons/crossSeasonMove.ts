import type { ReorderEpisodeItem, SeriesDetails } from '../api';

type Episode = SeriesDetails['episodes'][number];

export interface CrossSeasonMove {
  episodes: Episode[];
  orders: ReorderEpisodeItem[];
}

export function buildCrossSeasonMove(
  allEpisodes: Episode[],
  draggedEpisodeId: string,
  targetSeasonId: string
): CrossSeasonMove | null {
  const dragged = allEpisodes.find((ep) => ep.id === draggedEpisodeId);
  if (!dragged || dragged.seasonId === targetSeasonId) {
    return null;
  }

  const sourceSeasonId = dragged.seasonId;

  // Close the gap left behind in the source season by re-indexing the
  // remaining episodes to absolute positions 1..n.
  const remainingSource = allEpisodes
    .filter((ep) => ep.id !== dragged.id && ep.seasonId === sourceSeasonId)
    .sort((a, b) => (a.order ?? 1) - (b.order ?? 1))
    .map((ep, idx) => ({ ...ep, order: idx + 1 }));

  // Append the dragged episode at the end of the target season.
  const targetOrders = allEpisodes
    .filter((ep) => ep.seasonId === targetSeasonId && ep.id !== dragged.id)
    .map((ep) => ep.order ?? 0);
  const nextTargetOrder =
    (targetOrders.length > 0 ? Math.max(...targetOrders) : 0) + 1;

  const moved: Episode = {
    ...dragged,
    seasonId: targetSeasonId,
    order: nextTargetOrder,
  };

  const updates = new Map<string, Episode>();
  for (const ep of remainingSource) updates.set(ep.id, ep);
  updates.set(moved.id, moved);

  const episodes = allEpisodes.map((ep) => updates.get(ep.id) ?? ep);

  const orders: ReorderEpisodeItem[] = [
    ...remainingSource.map((ep) => ({ id: ep.id, order: ep.order })),
    { id: moved.id, order: nextTargetOrder, seasonId: targetSeasonId },
  ];

  return { episodes, orders };
}

export function buildBulkCrossSeasonMove(
  allEpisodes: Episode[],
  selectedEpisodeIds: string[],
  targetSeasonId: string
): CrossSeasonMove | null {
  const selectedSet = new Set(selectedEpisodeIds);
  const toMove = allEpisodes
    .filter((ep) => selectedSet.has(ep.id) && ep.seasonId !== targetSeasonId)
    .sort((a, b) => (a.order ?? 1) - (b.order ?? 1));
  if (toMove.length === 0) {
    return null;
  }
  const movedIds = new Set(toMove.map((ep) => ep.id));

  // Re-index remaining episodes in every affected source season to 1..N.
  const sourceSeasonIds = [...new Set(toMove.map((ep) => ep.seasonId))];
  const updates = new Map<string, Episode>();
  const orders: ReorderEpisodeItem[] = [];

  for (const sourceSeasonId of sourceSeasonIds) {
    const remaining = allEpisodes
      .filter((ep) => ep.seasonId === sourceSeasonId && !movedIds.has(ep.id))
      .sort((a, b) => (a.order ?? 1) - (b.order ?? 1));
    remaining.forEach((ep, idx) => {
      const next = { ...ep, order: idx + 1 };
      updates.set(ep.id, next);
      orders.push({ id: ep.id, order: idx + 1 });
    });
  }

  // Append moved episodes sequentially after the current max target order,
  // preserving their relative selection order.
  const targetOrders = allEpisodes
    .filter((ep) => ep.seasonId === targetSeasonId && !movedIds.has(ep.id))
    .map((ep) => ep.order ?? 0);
  let nextTargetOrder =
    (targetOrders.length > 0 ? Math.max(...targetOrders) : 0) + 1;

  for (const ep of toMove) {
    const moved: Episode = {
      ...ep,
      seasonId: targetSeasonId,
      order: nextTargetOrder,
    };
    updates.set(ep.id, moved);
    orders.push({ id: ep.id, order: nextTargetOrder, seasonId: targetSeasonId });
    nextTargetOrder += 1;
  }

  const episodes = allEpisodes.map((ep) => updates.get(ep.id) ?? ep);
  return { episodes, orders };
}
