import { renderWithProviders, screen, act, waitFor } from '../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeriesDetailView } from '@/modules/videos/internal/SeriesDetailView';
import {
  buildCrossSeasonMove,
  type CrossSeasonMove,
} from '@/modules/videos/internal/crossSeasonMove';
import type { SeriesDetails } from '@/modules/videos/internal/api';
import { Toaster } from '@/components/ui/sonner';
import { setAccessToken } from '@/lib/api';

const dndHoisted = vi.hoisted(() => ({
  onDragEndCallbacks: [] as ((result: unknown) => void)[],
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
  }) => {
    const href = params ? to.replace('$seriesId', params.seriesId) : to;
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}));

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode;
    onDragEnd: (result: unknown) => void;
  }) => {
    dndHoisted.onDragEndCallbacks.push(onDragEnd);
    return <div data-testid="mock-dnd-context">{children}</div>;
  },
  Droppable: ({
    children,
    droppableId,
  }: {
    children: (provided: unknown, snapshot: unknown) => React.ReactNode;
    droppableId: string;
  }) => (
    <div data-testid={`droppable-${droppableId}`}>
      {children(
        { innerRef: () => {}, droppableProps: {}, placeholder: null },
        { isDraggingOver: false }
      )}
    </div>
  ),
  Draggable: ({
    children,
    draggableId,
  }: {
    children: (provided: unknown, snapshot: unknown) => React.ReactNode;
    draggableId: string;
  }) => (
    <div data-testid={`draggable-${draggableId}`}>
      {children(
        { innerRef: () => {}, draggableProps: {}, dragHandleProps: {} },
        { isDragging: false }
      )}
    </div>
  ),
}));

const season1 = {
  id: 'season-1-id',
  seriesId: 'cross-drop-series',
  sourceUrl: 'https://otakudesu.cloud/season-1',
  source: 'otakudesu',
  title: 'Season 1',
  description: null,
  posterUrl: null,
  createdAt: '2026-08-10',
  updatedAt: '2026-08-10',
  episodes: [],
};

const season2 = {
  id: 'season-2-id',
  seriesId: 'cross-drop-series',
  sourceUrl: 'https://otakudesu.cloud/season-2',
  source: 'otakudesu',
  title: 'Season 2',
  description: null,
  posterUrl: null,
  createdAt: '2026-08-10',
  updatedAt: '2026-08-10',
  episodes: [],
};

const mockEpisodes = [
  {
    id: 's1-ep1',
    seasonId: 'season-1-id',
    sourceUrl: 'https://otakudesu.cloud/s1-ep1',
    source: 'otakudesu',
    title: 'S1 Episode 1',
    order: 1,
    videoSources: [],
    createdAt: '2026-08-10',
    updatedAt: '2026-08-10',
  },
  {
    id: 's1-ep2',
    seasonId: 'season-1-id',
    sourceUrl: 'https://otakudesu.cloud/s1-ep2',
    source: 'otakudesu',
    title: 'S1 Episode 2',
    order: 2,
    videoSources: [],
    createdAt: '2026-08-10',
    updatedAt: '2026-08-10',
  },
  {
    id: 's2-ep1',
    seasonId: 'season-2-id',
    sourceUrl: 'https://otakudesu.cloud/s2-ep1',
    source: 'otakudesu',
    title: 'S2 Episode 1',
    order: 1,
    videoSources: [],
    createdAt: '2026-08-10',
    updatedAt: '2026-08-10',
  },
];

const mockSeries: SeriesDetails = {
  id: 'cross-drop-series',
  sourceUrl: 'https://otakudesu.cloud/anime/cross-drop',
  source: 'otakudesu',
  title: 'Cross Drop Anime',
  description: 'Series overview',
  posterUrl: null,
  createdAt: '2026-08-10',
  updatedAt: '2026-08-10',
  seasons: [season1, season2],
  episodes: mockEpisodes,
};

describe('buildCrossSeasonMove pure function unit logic', () => {
  it('returns null if dragged episode is not found or already in target season', () => {
    expect(buildCrossSeasonMove(mockEpisodes, 'missing-id', 'season-2-id')).toBeNull();
    expect(buildCrossSeasonMove(mockEpisodes, 's1-ep1', 'season-1-id')).toBeNull();
  });

  it('calculates gap-closing in source season and appends at end of target season', () => {
    const move = buildCrossSeasonMove(
      mockEpisodes,
      's1-ep1',
      'season-2-id'
    ) as CrossSeasonMove;

    expect(move).not.toBeNull();

    // Source season (season-1): s1-ep2 remaining, re-indexed to order 1
    const s1ep2Updated = move.episodes.find((e) => e.id === 's1-ep2');
    expect(s1ep2Updated?.order).toBe(1);
    expect(s1ep2Updated?.seasonId).toBe('season-1-id');

    // Target season (season-2): s1-ep1 moved into season-2, order max(1)+1 = 2
    const s1ep1Moved = move.episodes.find((e) => e.id === 's1-ep1');
    expect(s1ep1Moved?.seasonId).toBe('season-2-id');
    expect(s1ep1Moved?.order).toBe(2);

    // Orders payload sent to server
    expect(move.orders).toEqual([
      { id: 's1-ep2', order: 1 },
      { id: 's1-ep1', order: 2, seasonId: 'season-2-id' },
    ]);
  });
});

describe('Cross-Season Drop integration in SeriesDetailView', () => {
  beforeEach(() => {
    setAccessToken('test-token');
    dndHoisted.onDragEndCallbacks = [];
  });

  it('renders Season Tabs as Droppable containers and fires PATCH with seasonId when dropped onto a tab', async () => {
    let patchPayload: unknown = null;
    let patchCalled = false;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method?.toUpperCase() ?? 'GET';

      if (url.includes('/series/cross-drop-series/episodes/order') && method === 'PATCH') {
        patchCalled = true;
        patchPayload = JSON.parse(init?.body as string);
        return new Response(JSON.stringify({ data: { success: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/series/cross-drop-series')) {
        return new Response(JSON.stringify({ data: mockSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }),
        { status: 404 }
      );
    });

    renderWithProviders(
      <>
        <SeriesDetailView seriesId="cross-drop-series" />
        <Toaster />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: 'Cross Drop Anime' });

    // Verify Season Tabs rendered as droppable targets
    expect(screen.getByTestId('droppable-season-tab-season-1-id')).toBeInTheDocument();
    expect(screen.getByTestId('droppable-season-tab-season-2-id')).toBeInTheDocument();

    // Trigger onDragEnd dropping s1-ep1 onto season-2 tab
    const handleDragEnd = dndHoisted.onDragEndCallbacks[dndHoisted.onDragEndCallbacks.length - 1];
    expect(handleDragEnd).toBeDefined();

    act(() => {
      handleDragEnd({
        draggableId: 's1-ep1',
        source: { droppableId: 'episodes-list', index: 0 },
        destination: { droppableId: 'season-tab-season-2-id', index: 0 },
      });
    });

    // Verify patch was called with reorder payload including seasonId
    await waitFor(() => {
      expect(patchCalled).toBe(true);
    });
    expect(patchPayload).toEqual([
      { id: 's1-ep2', order: 1 },
      { id: 's1-ep1', order: 2, seasonId: 'season-2-id' },
    ]);
  });
});
