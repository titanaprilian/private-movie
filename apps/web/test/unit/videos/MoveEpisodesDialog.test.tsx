import { renderWithProviders, screen, fireEvent, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildBulkCrossSeasonMove } from '@/modules/videos/internal/seasons/crossSeasonMove';
import { MoveEpisodesDialog } from '@/modules/videos/internal/seasons/MoveEpisodesDialog';
import { SeriesDetailView } from '@/modules/videos/internal/catalog/SeriesDetailView';
import type { SeriesDetails } from '@/modules/videos/internal/api';
import { Toaster } from '@/components/ui/sonner';
import { setAccessToken } from '@/lib/api';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}));

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Droppable: ({
    children,
  }: {
    children: (p: unknown, s: unknown) => React.ReactNode;
  }) => (
    <div>
      {children({ innerRef: () => {}, droppableProps: {} }, { isDraggingOver: false })}
    </div>
  ),
  Draggable: ({
    children,
  }: {
    children: (p: unknown, s: unknown) => React.ReactNode;
  }) => (
    <div>
      {children(
        { innerRef: () => {}, draggableProps: {}, dragHandleProps: {} },
        { isDragging: false }
      )}
    </div>
  ),
}));

type Season = NonNullable<SeriesDetails['seasons']>[number];
type EpisodeList = NonNullable<SeriesDetails['episodes']>;

const season1: Season = {
  id: 's1',
  seriesId: 'series-1',
  sourceUrl: null,
  source: null,
  title: 'Season 1',
  seasonNumber: 1,
  description: null,
  posterUrl: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  episodes: [],
} as unknown as Season;

const season2: Season = {
  ...season1,
  id: 's2',
  title: 'Season 2',
  seasonNumber: 2,
} as unknown as Season;

function ep(id: string, seasonId: string, order: number) {
  return {
    id,
    seasonId,
    sourceUrl: `https://x/${id}`,
    source: 'otakudesu',
    title: id,
    order,
    videoSources: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

describe('buildBulkCrossSeasonMove', () => {
  it('returns null when nothing selected or all already in target', () => {
    const all = [ep('a', 's1', 1)];
    expect(buildBulkCrossSeasonMove(all, [], 's2')).toBeNull();
    expect(buildBulkCrossSeasonMove(all, ['a'], 's1')).toBeNull();
    expect(buildBulkCrossSeasonMove(all, ['missing'], 's2')).toBeNull();
  });

  it('appends preserving relative order and closes source gaps', () => {
    const all = [
      ep('a', 's1', 1),
      ep('b', 's1', 2),
      ep('c', 's1', 3),
      ep('d', 's1', 4),
      ep('t1', 's2', 1),
      ep('t2', 's2', 2),
    ];
    const move = buildBulkCrossSeasonMove(all, ['b', 'd'], 's2')!;
    expect(move).not.toBeNull();
    // moved appended at 3,4 preserving b-before-d order
    expect(move.episodes.find((e) => e.id === 'b')).toMatchObject({ seasonId: 's2', order: 3 });
    expect(move.episodes.find((e) => e.id === 'd')).toMatchObject({ seasonId: 's2', order: 4 });
    // source re-indexed a->1, c->2
    expect(move.episodes.find((e) => e.id === 'a')).toMatchObject({ order: 1 });
    expect(move.episodes.find((e) => e.id === 'c')).toMatchObject({ order: 2 });
    // orders payload: source gap closure first, then moves
    expect(move.orders).toEqual([
      { id: 'a', order: 1 },
      { id: 'c', order: 2 },
      { id: 'b', order: 3, seasonId: 's2' },
      { id: 'd', order: 4, seasonId: 's2' },
    ]);
  });

  it('starts at 1 when target season is empty', () => {
    const all = [ep('a', 's1', 1), ep('b', 's1', 2)];
    const move = buildBulkCrossSeasonMove(all, ['a'], 's2')!;
    expect(move.episodes.find((e) => e.id === 'a')).toMatchObject({ seasonId: 's2', order: 1 });
    expect(move.episodes.find((e) => e.id === 'b')).toMatchObject({ order: 1 });
  });
});

describe('MoveEpisodesDialog', () => {
  it('excludes current season, shows counts, and confirms selection', () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <MoveEpisodesDialog
        open
        onOpenChange={() => {}}
        seasons={[season1, season2]}
        currentSeasonId="s1"
        selectedCount={2}
        episodeCountBySeason={{ s1: 4, s2: 2 }}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByText('Move Episodes to Season')).toBeInTheDocument();
    // current season excluded
    expect(screen.queryByRole('radio', { name: /Season 1/ })).not.toBeInTheDocument();
    const target = screen.getByRole('radio', { name: 'Season 2 (2 episodes)' });
    expect(target).toBeInTheDocument();
    // confirm disabled until selection
    const confirm = screen.getByRole('button', { name: /Move 2 Episodes/ });
    expect(confirm).toBeDisabled();
    fireEvent.click(target);
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('s2');
  });
});

describe('SeriesDetailView bulk move integration', () => {
  beforeEach(() => {
    setAccessToken('test-token');
  });

  it('shows Move to Season in bulk bar after selection and PATCHes on confirm', async () => {
    const mockSeries: SeriesDetails = {
      id: 'series-1',
      sourceUrl: 'https://x',
      source: 'otakudesu',
      title: 'Bulk Move Anime',
      description: 'desc',
      posterUrl: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      seasons: [season1, season2],
      episodes: [
        ep('a', 's1', 1),
        ep('b', 's1', 2),
        ep('t1', 's2', 1),
      ] as unknown as EpisodeList,
    };

    let patchPayload: unknown = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      const method = init?.method?.toUpperCase() ?? 'GET';
      if (url.includes('/series/series-1/episodes/order') && method === 'PATCH') {
        patchPayload = JSON.parse(init?.body as string);
        return new Response(JSON.stringify({ data: { success: true } }), { status: 200 });
      }
      if (url.includes('/series/series-1')) {
        return new Response(JSON.stringify({ data: mockSeries }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { message: 'nf' } }), { status: 404 });
    });

    renderWithProviders(
      <>
        <SeriesDetailView seriesId="series-1" initialSeasonId="s1" />
        <Toaster />
      </>
    );
    await screen.findByRole('heading', { level: 1, name: 'Bulk Move Anime' });

    // No bulk bar before selection
    expect(screen.queryByRole('toolbar', { name: 'Bulk selection actions' })).not.toBeInTheDocument();

    // Select episodes via checkboxes (select-all then dialog flow is enough:
    // click the first row checkbox directly)
    const checkboxes = await screen.findAllByRole('checkbox');
    // first checkbox is select-all; click it to select visible episodes
    fireEvent.click(checkboxes[0]);

    const toolbar = await screen.findByRole('toolbar', { name: 'Bulk selection actions' });
    expect(toolbar).toBeInTheDocument();
    const moveBtn = screen.getByRole('button', { name: /Move to Season/ });
    expect(moveBtn).toBeInTheDocument();
    fireEvent.click(moveBtn);

    // Dialog lists destination season with count
    const radio = await screen.findByRole('radio', { name: /Season 2/ });
    fireEvent.click(radio);
    const confirm = screen.getByRole('button', { name: /Move \d+ Episode/ });
    fireEvent.click(confirm);

    await waitFor(() => expect(patchPayload).not.toBeNull());
    const payload = patchPayload as Array<{ id: string; order: number; seasonId?: string }>;
    // moved rows carry seasonId s2
    expect(payload.some((p) => p.seasonId === 's2')).toBe(true);

    (vi.mocked(globalThis.fetch) as unknown as { mockRestore: () => void }).mockRestore();
  });
});
