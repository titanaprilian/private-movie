import { createTestQueryClient, renderWithProviders, screen, fireEvent, waitFor, within } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  SeriesGrid,
  seriesListQueryOptions,
  updateSeries,
  type SeriesListResponse,
} from '@/modules/videos';
import { genresQueryOptions, type Genre } from '@/modules/genres';
import { EditSeriesDialog } from '@/modules/videos/internal/EditSeriesDialog';
import type { SeriesItem } from '@/modules/videos/internal/api';

vi.mock('@/modules/videos/internal/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/modules/videos/internal/api')>();
  return {
    ...mod,
    updateSeries: vi.fn().mockImplementation(async (id: string, updates: Record<string, unknown>) => ({
      id,
      title: 'Updated',
      ...updates,
    })),
    deleteSeries: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
let mockSearchState: {
  page?: number;
  q?: string;
  genre?: string;
  tab?: 'all' | 'featured' | 'ongoing';
  highlighted?: boolean;
} = { page: 1, tab: 'ongoing' };

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
    onClick?: () => void;
  }) => {
    const href = params ? to.replace('$seriesId', params.seriesId) : to;
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  },
  useSearch: () => mockSearchState,
  useNavigate: () => mockNavigate,
}));

const mockGenres: Genre[] = [
  { id: 'g-anime', name: 'Anime', slug: 'anime', isBigGenre: true, displayOrder: 0 },
  { id: 'g-kdrama', name: 'Korean Drama', slug: 'korean-drama', isBigGenre: true, displayOrder: 1 },
  { id: 'g-action', name: 'Action', slug: 'action', isBigGenre: false, displayOrder: 2 },
];

const highlightedSeriesItem = {
  id: 'series-highlighted',
  title: 'Highlighted Ongoing Show',
  source: 'otakudesu',
  sourceUrl: 'https://otakudesu.cloud/anime/highlighted',
  description: 'A highlighted show.',
  posterUrl: 'https://example.com/highlighted.jpg',
  isFeatured: false,
  isOngoingHighlighted: true,
  genres: [{ id: 'g-anime', name: 'Anime', slug: 'anime' }],
  seasons: [{ id: 'sea-1', title: 'Season 1', status: 'ongoing' }],
  episodes: [],
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const plainSeriesItem = {
  id: 'series-plain',
  title: 'Plain Ongoing Show',
  source: 'otakudesu',
  sourceUrl: 'https://otakudesu.cloud/anime/plain',
  description: 'A plain show.',
  posterUrl: 'https://example.com/plain.jpg',
  isFeatured: false,
  isOngoingHighlighted: false,
  genres: [{ id: 'g-anime', name: 'Anime', slug: 'anime' }],
  seasons: [{ id: 'sea-2', title: 'Season 1', status: 'ongoing' }],
  episodes: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockOngoingResponse = {
  series: [highlightedSeriesItem, plainSeriesItem],
  meta: { total: 2, page: 1, limit: 20 },
};

function renderOngoingGrid(
  searchState: typeof mockSearchState = { page: 1, tab: 'ongoing' },
  customResponse: unknown = mockOngoingResponse
) {
  mockSearchState = searchState;
  mockNavigate.mockReset();
  vi.mocked(updateSeries).mockClear();
  const queryClient = createTestQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } });
  queryClient.setQueryData(
    seriesListQueryOptions(searchState).queryKey,
    customResponse as SeriesListResponse
  );
  queryClient.setQueryData(genresQueryOptions().queryKey, mockGenres);
  queryClient.setQueryData(
    seriesListQueryOptions({ filter: 'ongoing', highlighted: true, limit: 100 }).queryKey,
    { series: [highlightedSeriesItem], meta: { total: 1, page: 1, limit: 100 } }
  );
  return renderWithProviders(<SeriesGrid />, { queryClient });
}

describe('Ongoing highlight curation (admin videos)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Big Genre quick-filter chips with highlighted counts in the ongoing tab', async () => {
    renderOngoingGrid();

    const chipRegion = screen.getByLabelText('Filter by big genre');
    expect(within(chipRegion).getByText('Anime')).toBeInTheDocument();
    expect(within(chipRegion).getByText('Korean Drama')).toBeInTheDocument();
    expect(within(chipRegion).queryByText('Action')).not.toBeInTheDocument();
    // Highlighted count badge for Anime (1 highlighted series in seeded cache)
    expect(
      within(chipRegion).getByLabelText('1 highlighted in Anime')
    ).toBeInTheDocument();
  });

  it('does not render Big Genre chips outside the ongoing tab', () => {
    renderOngoingGrid({ page: 1, tab: 'all' });

    expect(screen.queryByLabelText('Filter by big genre')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('switch', { name: 'Highlighted Only' })
    ).not.toBeInTheDocument();
  });

  it('toggles the Highlighted Only filter via navigation', () => {
    renderOngoingGrid();

    fireEvent.click(screen.getByRole('switch', { name: /Highlighted Only/i }));
    expect(mockNavigate).toHaveBeenCalled();
    const searchUpdater = mockNavigate.mock.calls[0][0].search as (
      old: Record<string, unknown>
    ) => Record<string, unknown>;
    expect(searchUpdater({ tab: 'ongoing', page: 2 })).toMatchObject({
      highlighted: true,
      page: 1,
    });
  });

  it('filters chips navigate with the big genre slug', () => {
    renderOngoingGrid();

    fireEvent.click(screen.getByRole('button', { name: /Korean Drama/ }));
    expect(mockNavigate).toHaveBeenCalled();
    const searchUpdater = mockNavigate.mock.calls[0][0].search as (
      old: Record<string, unknown>
    ) => Record<string, unknown>;
    expect(searchUpdater({ tab: 'ongoing' })).toMatchObject({
      genre: 'korean-drama',
      page: 1,
    });
  });

  it('displays the Highlighted Ongoing badge on highlighted cards only', () => {
    renderOngoingGrid();

    const badges = screen.getAllByText('Highlighted Ongoing');
    expect(badges).toHaveLength(1);
    const card = screen.getByText('Highlighted Ongoing Show').closest('div.group');
    expect(card).toHaveTextContent('Highlighted Ongoing');
    const plainCard = screen.getByText('Plain Ongoing Show').closest('div.group');
    expect(plainCard).not.toHaveTextContent('Highlighted Ongoing');
  });

  it('toggles highlight via the 1-click star button with optimistic update', async () => {
    renderOngoingGrid();

    fireEvent.click(screen.getByRole('button', { name: 'Highlight Plain Ongoing Show' }));

    await waitFor(() => {
      expect(vi.mocked(updateSeries)).toHaveBeenCalledWith('series-plain', {
        isOngoingHighlighted: true,
      });
    });
    // Optimistic UI: badge appears immediately without waiting for invalidation
    await waitFor(() => {
      const plainCard = screen.getByText('Plain Ongoing Show').closest('div.group');
      expect(plainCard).toHaveTextContent('Highlighted Ongoing');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Unhighlight Highlighted Ongoing Show' }));
    await waitFor(() => {
      expect(vi.mocked(updateSeries)).toHaveBeenCalledWith('series-highlighted', {
        isOngoingHighlighted: false,
      });
    });
  });
});

describe('EditSeriesDialog highlight checkbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderDialog(series: SeriesItem) {
    const queryClient = createTestQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } });
    queryClient.setQueryData(genresQueryOptions().queryKey, []);
    return renderWithProviders(
      <EditSeriesDialog open onOpenChange={() => {}} series={series} />,
      { queryClient }
    );
  }

  it('reflects the current highlight state and persists it on save', async () => {
    const series = {
      ...(highlightedSeriesItem as unknown as SeriesItem),
      sourceUrl: highlightedSeriesItem.sourceUrl,
      source: highlightedSeriesItem.source,
    };
    renderDialog(series);

    const checkbox = screen.getByLabelText('Highlight in Ongoing Feed');
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(vi.mocked(updateSeries)).toHaveBeenCalledWith(
        'series-highlighted',
        expect.objectContaining({ isOngoingHighlighted: false })
      );
    });
  });
});
