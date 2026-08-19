import { createTestQueryClient, renderWithProviders, screen, fireEvent } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { SeriesGrid, seriesListQueryOptions } from '@/modules/videos';

const mockNavigate = vi.fn();
let mockSearchState: { page?: number; q?: string } = { page: 1, q: undefined };

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    search,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: unknown;
    className?: string;
    onClick?: () => void;
  }) => {
    let href = params ? to.replace('$seriesId', params.seriesId) : to;
    if (search) {
      const searchObj = typeof search === 'function' ? search(mockSearchState) : search;
      const searchParams = new URLSearchParams();
      if (searchObj.page) searchParams.set('page', String(searchObj.page));
      if (searchObj.q) searchParams.set('q', searchObj.q);
      const str = searchParams.toString();
      if (str) href += `?${str}`;
    }
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  },
  useSearch: () => mockSearchState,
  useNavigate: () => mockNavigate,
}));

const mockSeriesResponse = {
  series: [
    {
      id: 'series-1',
      title: 'Solo Leveling',
      source: 'otakudesu',
      sourceUrl: 'https://otakudesu.cloud/anime/solo-leveling',
      description: 'Sung Jinwoo ascends from E-rank hunter to shadow monarch.',
      posterUrl: 'https://example.com/solo-leveling.jpg',
      episodes: [
        { id: 'ep-1', title: 'Episode 1' },
        { id: 'ep-2', title: 'Episode 2' },
      ],
      createdAt: '2025-01-12T00:00:00.000Z',
      updatedAt: '2025-01-12T00:00:00.000Z',
    },
    {
      id: 'series-2',
      title: 'Frieren: Beyond Journey\'s End',
      source: 'otakudesu',
      sourceUrl: 'https://otakudesu.cloud/anime/frieren',
      description: 'An elf mage reflects on life after defeating the Demon King.',
      posterUrl: 'https://example.com/frieren.jpg',
      episodes: [],
      createdAt: '2025-01-10T00:00:00.000Z',
      updatedAt: '2025-01-10T00:00:00.000Z',
    },
  ],
  meta: {
    total: 2,
    page: 1,
    limit: 20,
  },
};

function renderSeriesGrid(
  customResponse = mockSeriesResponse,
  searchState: { page?: number; q?: string } = { page: 1, q: undefined }
) {
  mockSearchState = searchState;
  mockNavigate.mockReset();
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(seriesListQueryOptions(searchState).queryKey, customResponse);
  return renderWithProviders(<SeriesGrid />, { queryClient });
}

describe('SeriesGrid component', () => {
  it('renders page heading, add video button and filter placeholder', () => {
    renderSeriesGrid();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Videos' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Add (Video|Media)/i })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filter series...')).toBeInTheDocument();
  });

  it('renders series cards with poster images, title, description and episode count badge', () => {
    renderSeriesGrid();

    expect(screen.getByText('Solo Leveling')).toBeInTheDocument();
    expect(
      screen.getByText('Sung Jinwoo ascends from E-rank hunter to shadow monarch.')
    ).toBeInTheDocument();
    expect(screen.getByText('Frieren: Beyond Journey\'s End')).toBeInTheDocument();
    expect(
      screen.getByText('An elf mage reflects on life after defeating the Demon King.')
    ).toBeInTheDocument();

    expect(screen.getByText('2 episodes')).toBeInTheDocument();
    expect(screen.getByText('0 episodes')).toBeInTheDocument();

    const img = screen.getByAltText('Solo Leveling');
    expect(img).toHaveAttribute('src', 'https://example.com/solo-leveling.jpg');
  });

  it('triggers debounced navigate when typing in filter input', () => {
    vi.useFakeTimers();
    renderSeriesGrid();

    const input = screen.getByPlaceholderText('Filter series...');
    fireEvent.change(input, { target: { value: 'Solo' } });

    expect(mockNavigate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    });

    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({})).toEqual({ q: 'Solo', page: 1 });

    vi.useRealTimers();
  });

  it('renders pagination bar when total exceeds page limit', () => {
    const paginatedResponse = {
      ...mockSeriesResponse,
      meta: {
        total: 25,
        page: 1,
        limit: 20,
      },
    };
    renderSeriesGrid(paginatedResponse);

    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toHaveClass('opacity-50');
    const nextLink = screen.getByText('Next').closest('a');
    expect(nextLink).toHaveAttribute('href', '/videos?page=2');
  });

  it('navigates to /videos/$seriesId when clicking a series card', () => {
    renderSeriesGrid();

    const link = screen.getByText('Solo Leveling').closest('a');
    expect(link).toHaveAttribute('href', '/videos/series-1');
  });

  it('opens AddMediaDialog when Add Video button is clicked', async () => {
    const { user } = renderSeriesGrid();

    const addBtn = screen.getByRole('button', { name: /Add (Video|Media)/i });
    await user.click(addBtn);

    expect(screen.getByText('Add Media Wizard')).toBeInTheDocument();
  });
});
