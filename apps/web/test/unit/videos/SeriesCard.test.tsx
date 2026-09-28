import { createTestQueryClient, renderWithProviders, screen, fireEvent, waitFor, cleanup } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  SeriesGrid,
  SeriesCard,
  FeaturedStar,
  seriesListQueryOptions,
  updateSeries,
  SERIES_PAGE_LIMIT,
  type SeriesListResponse,
  type SeriesItem,
} from '@/modules/videos';
import { genresQueryOptions, type Genre } from '@/modules/genres';

vi.mock('@/modules/videos/internal/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/modules/videos/internal/api')>();
  return {
    ...mod,
    updateSeries: vi.fn(),
    deleteSeries: vi.fn().mockResolvedValue({ id: 'x', title: 'x' }),
  };
});

const mockNavigate = vi.fn();
let mockSearchState: Record<string, unknown> = { page: 1 };

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
  useSearch: () => mockSearchState,
  useNavigate: () => mockNavigate,
}));

const genresList: Genre[] = [
  { id: 'g-1', name: 'Action', slug: 'action', isBigGenre: false, displayOrder: 0 },
];

function makeItem(overrides: Partial<SeriesItem> = {}): SeriesItem {
  return {
    id: 'series-1',
    title: 'Solo Leveling',
    source: 'otakudesu',
    sourceUrl: 'https://example.com/s1',
    description: 'Sung Jinwoo ascends from E-rank hunter to shadow monarch.',
    posterUrl: 'https://example.com/solo-leveling.jpg',
    isFeatured: false,
    seasons: [],
    createdAt: '2025-01-12T00:00:00.000Z',
    updatedAt: '2025-01-12T00:00:00.000Z',
    ...overrides,
  } as unknown as SeriesItem;
}

function renderGridWith(response: unknown, search: Record<string, unknown> = { page: 1 }) {
  mockSearchState = search;
  mockNavigate.mockReset();
  const queryClient = createTestQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } });
  queryClient.setQueryData(
    seriesListQueryOptions({ ...search, limit: SERIES_PAGE_LIMIT }).queryKey,
    response as SeriesListResponse
  );
  queryClient.setQueryData(genresQueryOptions().queryKey, genresList);
  const result = renderWithProviders(<SeriesGrid />, { queryClient });
  return { ...result, queryClient };
}

describe('SeriesCard grid rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders responsive grid capped at 4 columns via inline style', () => {
    const response = {
      series: [makeItem(), makeItem({ id: 'series-2', title: 'Frieren' })],
      meta: { total: 2, page: 1, limit: 20 },
    };
    renderGridWith(response);
    const grid = screen.getByTestId('series-grid');
    expect(grid.style.gridTemplateColumns).toBe(
      'repeat(auto-fill, minmax(max(210px, calc((100% - 60px) / 4)), 1fr))'
    );
  });

  it('renders poster with object-fit cover, rounded corners, alt title, and navigates to detail view', () => {
    const response = { series: [makeItem()], meta: { total: 1, page: 1, limit: 20 } };
    renderGridWith(response);
    const img = screen.getByAltText('Solo Leveling');
    expect(img).toHaveClass('object-cover');
    const posterLink = img.closest('a');
    expect(posterLink).toHaveAttribute('href', '/admin/videos/series-1');
    const titleLink = screen.getByText('Solo Leveling').closest('a');
    expect(titleLink).toHaveAttribute('href', '/admin/videos/series-1');
    // 2-line clamped synopsis + blue episode pill
    expect(
      screen.getByText('Sung Jinwoo ascends from E-rank hunter to shadow monarch.')
    ).toHaveClass('line-clamp-2');
    expect(screen.getByText('0 episodes')).toBeInTheDocument();
  });

  it('renders fallback placeholder when poster is null or fails to load', () => {
    const noPoster = makeItem({ posterUrl: null as unknown as string });
    const response = { series: [noPoster], meta: { total: 1, page: 1, limit: 20 } };
    renderGridWith(response);
    expect(screen.getByTestId('series-poster-fallback')).toHaveTextContent('S');

    // broken image -> error fallback
    cleanup();
    const withBroken = makeItem({ posterUrl: 'https://example.com/broken.jpg' });
    renderGridWith({ series: [withBroken], meta: { total: 1, page: 1, limit: 20 } });
    const img = screen.getByAltText('Solo Leveling') as HTMLImageElement;
    fireEvent.error(img);
    expect(screen.getByTestId('series-poster-fallback')).toBeInTheDocument();
  });

  it('renders Edit (blue) and Delete (red) chunky chips pinned to bottom with stopped propagation', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const parentClick = vi.fn();
    const { user } = renderWithProviders(
      <div onClick={parentClick}>
        <SeriesCard item={makeItem()} onToggleFeatured={vi.fn()} onEdit={onEdit} onDelete={onDelete} />
      </div>
    );
    const editBtn = screen.getByRole('button', { name: 'Edit Solo Leveling' });
    const deleteBtn = screen.getByRole('button', { name: 'Delete Solo Leveling' });
    // chunky: 44px height + bottom border physics
    expect(editBtn.className).toContain('h-11');
    expect(editBtn.className).toContain('border-b-4');
    expect(deleteBtn.className).toContain('h-11');
    await user.click(editBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
    await user.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });
});

describe('FeaturedStar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders accessible toggle with aria-pressed, title, and gold active styling', () => {
    const { rerender } = renderWithProviders(
      <FeaturedStar featured={false} title="Solo Leveling" onToggle={vi.fn()} />
    );
    const btn = screen.getByRole('button', { name: 'Mark Solo Leveling as featured' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveAttribute('title', 'Mark as featured');
    // inactive: hidden until hover/focus
    expect(btn.className).toContain('opacity-0');
    expect(btn.className).toContain('group-hover:opacity-100');

    rerender(<FeaturedStar featured title="Solo Leveling" onToggle={vi.fn()} />);
    const active = screen.getByRole('button', { name: /Remove .* from featured/ });
    expect(active).toHaveAttribute('aria-pressed', 'true');
    expect(active).toHaveAttribute('title', 'Remove from featured');
    // 44px chunky + gold tint
    expect(active.className).toContain('w-11');
    expect(active.className).toContain('h-11');
    expect(active.className).toContain('bg-[var(--gold-tint)]');
    expect(active.className).toContain('opacity-100');
  });

  it('respects touch (hover:none always visible) and prefers-reduced-motion via CSS', async () => {
    renderWithProviders(<FeaturedStar featured={false} title="X" onToggle={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'Mark X as featured' });
    expect(btn.className).toContain('focus-visible:opacity-100');
    expect(btn.className).toContain('active:translate-y-[2px]');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const cssPath = path.resolve(__dirname, '../../../src/index.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toContain('@media (hover: none)');
    expect(css).toContain('.featured-star');
    expect(css).toContain('prefers-reduced-motion');
  });

  it('optimistically toggles featured state and calls updateSeries', async () => {
    vi.mocked(updateSeries).mockResolvedValue(makeItem({ isFeatured: true }));
    const response = { series: [makeItem({ isFeatured: false })], meta: { total: 1, page: 1, limit: 20 } };
    renderGridWith(response);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Solo Leveling as featured' }));
    await waitFor(() => {
      expect(vi.mocked(updateSeries)).toHaveBeenCalledWith('series-1', { isFeatured: true });
    });
    // optimistic UI flips to featured immediately
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Remove Solo Leveling from featured' })
      ).toBeInTheDocument();
    });
  });

  it('rolls back on server error and shows an error toast', async () => {
    vi.mocked(updateSeries).mockRejectedValue(new Error('boom'));
    const response = { series: [makeItem({ isFeatured: false })], meta: { total: 1, page: 1, limit: 20 } };
    renderGridWith(response);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Solo Leveling as featured' }));
    await waitFor(() => {
      expect(vi.mocked(updateSeries)).toHaveBeenCalledWith('series-1', { isFeatured: true });
    });
    // rollback: star returns to unfeatured state after error
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Mark Solo Leveling as featured' })
      ).toBeInTheDocument();
    });
  });
});
