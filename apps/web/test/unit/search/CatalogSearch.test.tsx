import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createTestQueryClient, renderWithProviders, screen, fireEvent, waitFor, act } from '../../utils';
import { CatalogSearch, seriesSearchQueryOptions } from '@/modules/search';
import type { SeriesItem, SeriesListResponse } from '@/modules/videos';

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
    const href = params ? to.replace('$seriesId', params.seriesId ?? '') : to;
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  },
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}));

vi.mock('@/modules/videos', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/modules/videos')>();
  return {
    ...mod,
    fetchSeries: vi.fn(),
  };
});

import { fetchSeries } from '@/modules/videos';

const mockSeriesList: SeriesItem[] = [
  {
    id: 'series-1',
    title: 'Solo Leveling',
    source: 'otakudesu',
    sourceUrl: 'https://otakudesu.cloud/anime/solo-leveling',
    description: 'Sung Jinwoo ascends from E-rank hunter to shadow monarch.',
    posterUrl: 'https://example.com/solo-leveling.jpg',
    type: 'tv',
    genres: [{ id: 'g-1', name: 'Action', slug: 'action' }],
    seasons: [{ id: 's-1', title: 'Season 1' }],
    createdAt: '2024-01-10T00:00:00.000Z',
    updatedAt: '2024-01-10T00:00:00.000Z',
  },
  {
    id: 'series-2',
    title: 'Frieren: Beyond Journey\'s End',
    source: 'otakudesu',
    sourceUrl: 'https://otakudesu.cloud/anime/frieren',
    description: 'An elf mage reflects on life after defeating the Demon King.',
    posterUrl: 'https://example.com/frieren.jpg',
    type: 'tv',
    genres: [{ id: 'g-2', name: 'Fantasy', slug: 'fantasy' }],
    seasons: [{ id: 's-2', title: 'Season 1' }],
    createdAt: '2023-09-29T00:00:00.000Z',
    updatedAt: '2023-09-29T00:00:00.000Z',
  },
];

const mockSearchResponse: SeriesListResponse = {
  series: mockSeriesList,
  meta: {
    total: 2,
    page: 1,
    limit: 5,
  },
};

describe('CatalogSearch Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSeries).mockResolvedValue(mockSearchResponse);
  });

  it('renders search input with placeholder and search icon', () => {
    renderWithProviders(<CatalogSearch placeholder="Search catalog..." />);
    const input = screen.getByRole('textbox', { name: 'Search series catalog' });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Search catalog...');
  });

  it('triggers debounced fetchSeries query when typing in search input', async () => {
    vi.useFakeTimers();

    const queryClient = createTestQueryClient();
    renderWithProviders(<CatalogSearch />, { queryClient });

    const input = screen.getByRole('textbox', { name: 'Search series catalog' });
    fireEvent.change(input, { target: { value: 'Solo' } });

    // Before 300ms, fetchSeries should not be called
    expect(fetchSeries).not.toHaveBeenCalled();

    // Advance 300ms in act to flush React state update
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(fetchSeries).toHaveBeenCalledWith({
      q: 'Solo',
      genre: undefined,
      limit: 5,
    });

    vi.useRealTimers();
  });

  it('renders loading skeleton while query is debouncing or fetching', () => {
    vi.useFakeTimers();
    vi.mocked(fetchSeries).mockImplementation(() => new Promise(() => {})); // pending

    const queryClient = createTestQueryClient();
    renderWithProviders(<CatalogSearch />, { queryClient });

    const input = screen.getByRole('textbox', { name: 'Search series catalog' });
    fireEvent.change(input, { target: { value: 'Solo' } });

    // During debounce delay, skeleton is shown
    expect(screen.getByTestId('search-skeleton')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('renders matching series cards with poster, title, release year, type badge, season count, and genres', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setDefaultOptions({
      queries: { retry: false, staleTime: Infinity },
    });
    queryClient.setQueryData(
      seriesSearchQueryOptions('Solo').queryKey,
      mockSearchResponse
    );

    renderWithProviders(<CatalogSearch />, { queryClient });
    const input = screen.getByRole('textbox', { name: 'Search series catalog' });
    fireEvent.change(input, { target: { value: 'Solo' } });

    await waitFor(() => {
      expect(screen.getByText('Solo Leveling')).toBeInTheDocument();
    });

    expect(screen.getByText('2024')).toBeInTheDocument();
    expect(screen.getAllByText(/Season/i).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('rating-badge').length).toBe(2);
    expect(screen.getByText('Action')).toBeInTheDocument();

    expect(screen.getByText("Frieren: Beyond Journey's End")).toBeInTheDocument();
    expect(screen.getByText('2023')).toBeInTheDocument();
    expect(screen.getByText('Fantasy')).toBeInTheDocument();

    const img = screen.getByAltText('Solo Leveling');
    expect(img).toHaveAttribute('src', 'https://example.com/solo-leveling.jpg');
  });

  it('renders empty state "No series found" when query returns no series', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setDefaultOptions({
      queries: { retry: false, staleTime: Infinity },
    });
    queryClient.setQueryData(
      seriesSearchQueryOptions('Unknown').queryKey,
      { series: [], meta: { total: 0, page: 1, limit: 5 } }
    );

    renderWithProviders(<CatalogSearch />, { queryClient });
    const input = screen.getByRole('textbox', { name: 'Search series catalog' });
    fireEvent.change(input, { target: { value: 'Unknown' } });

    await waitFor(() => {
      expect(screen.getByTestId('search-empty')).toBeInTheDocument();
    });
    expect(screen.getByText('No series found')).toBeInTheDocument();
  });

  it('renders clear button (X icon) when query is non-empty and resets search state on click', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setDefaultOptions({
      queries: { retry: false, staleTime: Infinity },
    });
    queryClient.setQueryData(
      seriesSearchQueryOptions('Solo').queryKey,
      mockSearchResponse
    );

    renderWithProviders(<CatalogSearch />, { queryClient });
    const input = screen.getByRole('textbox', { name: 'Search series catalog' });
    fireEvent.change(input, { target: { value: 'Solo' } });

    await waitFor(() => {
      expect(screen.getByText('Solo Leveling')).toBeInTheDocument();
    });

    const clearBtn = screen.getByRole('button', { name: 'Clear search' });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);

    expect(input).toHaveValue('');
    expect(screen.queryByTestId('search-dropdown')).not.toBeInTheDocument();
  });

  it('invokes onSelectSeries callback and closes dropdown when series item is clicked', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setDefaultOptions({
      queries: { retry: false, staleTime: Infinity },
    });
    queryClient.setQueryData(
      seriesSearchQueryOptions('Solo').queryKey,
      mockSearchResponse
    );

    const onSelectSeries = vi.fn();
    renderWithProviders(
      <CatalogSearch onSelectSeries={onSelectSeries} />,
      { queryClient }
    );

    const input = screen.getByRole('textbox', { name: 'Search series catalog' });
    fireEvent.change(input, { target: { value: 'Solo' } });

    await waitFor(() => {
      expect(screen.getByText('Solo Leveling')).toBeInTheDocument();
    });

    const item = screen.getByText('Solo Leveling');
    fireEvent.click(item);

    expect(onSelectSeries).toHaveBeenCalledWith(mockSeriesList[0]);
    expect(screen.queryByTestId('search-dropdown')).not.toBeInTheDocument();
  });

  it('dismisses dropdown when Escape key is pressed or clicking outside', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setDefaultOptions({
      queries: { retry: false, staleTime: Infinity },
    });
    queryClient.setQueryData(
      seriesSearchQueryOptions('Solo').queryKey,
      mockSearchResponse
    );

    renderWithProviders(
      <div>
        <CatalogSearch />
        <button type="button">Outside element</button>
      </div>,
      { queryClient }
    );

    const input = screen.getByRole('textbox', { name: 'Search series catalog' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Solo' } });

    await waitFor(() => {
      expect(screen.getByTestId('search-dropdown')).toBeInTheDocument();
    });

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('search-dropdown')).not.toBeInTheDocument();

    // Focus again to open
    fireEvent.focus(input);
    expect(screen.getByTestId('search-dropdown')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside element' }));
    expect(screen.queryByTestId('search-dropdown')).not.toBeInTheDocument();
  });
});
