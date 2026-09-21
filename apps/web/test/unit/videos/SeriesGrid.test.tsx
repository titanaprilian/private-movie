import { createTestQueryClient, renderWithProviders, screen, fireEvent, within } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import {
  SeriesGrid,
  seriesListQueryOptions,
  updateSeries,
  deleteSeries,
  type SeriesListResponse,
} from '@/modules/videos';
import { genresQueryOptions, type Genre } from '@/modules/genres';

vi.mock('@/modules/videos/internal/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/modules/videos/internal/api')>();
  return {
    ...mod,
    updateSeries: vi.fn().mockResolvedValue({
      id: 'series-1',
      title: 'Solo Leveling Updated',
      description: 'Updated description',
      posterUrl: 'https://example.com/updated.jpg',
      createdAt: '2025-01-12T00:00:00.000Z',
      updatedAt: '2025-01-12T00:00:00.000Z',
    }),
    deleteSeries: vi.fn().mockResolvedValue({
      id: 'series-1',
      title: 'Solo Leveling',
      source: 'otakudesu',
      sourceUrl: 'https://otakudesu.cloud/anime/solo-leveling',
      createdAt: '2025-01-12T00:00:00.000Z',
      updatedAt: '2025-01-12T00:00:00.000Z',
    }),
  };
});

const mockNavigate = vi.fn();
let mockSearchState: { page?: number; q?: string; genre?: string; tab?: 'all' | 'featured' | 'ongoing' } = {
  page: 1,
  q: undefined,
  genre: undefined,
  tab: undefined,
};

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
      if (searchObj.genre) searchParams.set('genre', searchObj.genre);
      if (searchObj.tab) searchParams.set('tab', searchObj.tab);
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

const mockGenresList: Genre[] = [
  { id: 'g-1', name: 'Action', slug: 'action', isBigGenre: false, displayOrder: 0 },
  { id: 'g-2', name: 'Sci-Fi', slug: 'sci-fi', isBigGenre: false, displayOrder: 0 },
];

const mockSeriesResponse = {
  series: [
    {
      id: 'series-1',
      title: 'Solo Leveling',
      source: 'otakudesu',
      sourceUrl: 'https://otakudesu.cloud/anime/solo-leveling',
      description: 'Sung Jinwoo ascends from E-rank hunter to shadow monarch.',
      posterUrl: 'https://example.com/solo-leveling.jpg',
      isFeatured: false,
      seasons: [],
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
      isFeatured: false,
      seasons: [
        { id: 'sea-2', title: 'Season 1', status: 'completed' },
      ],
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
  customResponse: unknown = mockSeriesResponse,
  searchState: { page?: number; q?: string; genre?: string; tab?: 'all' | 'featured' | 'ongoing' } = {
    page: 1,
    q: undefined,
    genre: undefined,
    tab: undefined,
  },
  genresList: Genre[] = mockGenresList
) {
  mockSearchState = searchState;
  mockNavigate.mockReset();
  const queryClient = createTestQueryClient();
  queryClient.setDefaultOptions({
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  });
  queryClient.setQueryData(seriesListQueryOptions(searchState).queryKey, customResponse as SeriesListResponse);
  queryClient.setQueryData(genresQueryOptions().queryKey, genresList);
  return renderWithProviders(<SeriesGrid />, { queryClient });
}

describe('SeriesGrid component', () => {
  it('renders page heading, add series button, subtitle and filter placeholder', () => {
    renderSeriesGrid();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Series' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Manage and browse your series catalog.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Add Series/i })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filter series...')).toBeInTheDocument();
  });

  it('renders series cards with poster images, title, description, episode count badge, and 3:4 aspect ratio', () => {
    const { container } = renderSeriesGrid();

    expect(screen.getByText('Solo Leveling')).toBeInTheDocument();
    expect(
      screen.getByText('Sung Jinwoo ascends from E-rank hunter to shadow monarch.')
    ).toBeInTheDocument();
    expect(screen.getByText("Frieren: Beyond Journey's End")).toBeInTheDocument();
    expect(
      screen.getByText('An elf mage reflects on life after defeating the Demon King.')
    ).toBeInTheDocument();

    expect(screen.getByText('2 episodes')).toBeInTheDocument();
    expect(screen.getByText('0 episodes')).toBeInTheDocument();

    const img = screen.getByAltText('Solo Leveling');
    expect(img).toHaveAttribute('src', 'https://example.com/solo-leveling.jpg');

    const posterContainers = container.querySelectorAll('.aspect-\\[3\\/4\\]');
    expect(posterContainers.length).toBe(2);
  });

  it('renders fallback initial placeholder in 3:4 container when posterUrl is missing', () => {
    const noPosterResponse = {
      series: [
        {
          id: 'series-3',
          title: 'No Poster Anime',
          source: 'tmdb',
          sourceUrl: 'https://www.themoviedb.org/tv/12345',
          description: 'A series without poster.',
          posterUrl: null as unknown as string,
          episodes: [],
          createdAt: '2025-01-10T00:00:00.000Z',
          updatedAt: '2025-01-10T00:00:00.000Z',
        },
      ],
      meta: { total: 1, page: 1, limit: 20 },
    };
    const { container } = renderSeriesGrid(noPosterResponse);

    expect(screen.getByText('N')).toBeInTheDocument();
    const posterContainer = container.querySelector('.aspect-\\[3\\/4\\]');
    expect(posterContainer).toBeInTheDocument();
    expect(posterContainer).toHaveTextContent('N');
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
      replace: true,
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
    expect(nextLink).toHaveAttribute('href', '/admin/videos?page=2');
  });

  it('navigates to /admin/videos/$seriesId when clicking a series card', () => {
    renderSeriesGrid();

    const link = screen.getByText('Solo Leveling').closest('a');
    expect(link).toHaveAttribute('href', '/admin/videos/series-1');
  });

  it('opens AddMediaDialog when Add Series button is clicked', async () => {
    const { user } = renderSeriesGrid();

    const addBtn = screen.getByRole('button', { name: /Add Series/i });
    await user.click(addBtn);

    expect(screen.getByRole('heading', { level: 2, name: 'Add Series' })).toBeInTheDocument();
  });

  it('renders compact genre filter trigger button and active genre badges when genre param is set', () => {
    renderSeriesGrid(mockSeriesResponse, { page: 1, q: undefined, genre: 'sci-fi' });

    expect(screen.getByRole('combobox', { name: 'Filter by genre' })).toHaveTextContent('Genres (1)');
    expect(screen.getByText('Sci-Fi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Sci-Fi filter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
  });

  it('opens combobox popover, filters genres by search, and navigates with multi-select ?genre= value', async () => {
    const { user } = renderSeriesGrid();

    const trigger = screen.getByRole('combobox', { name: 'Filter by genre' });
    expect(trigger).toHaveTextContent('Filter by genre');
    await user.click(trigger);

    const genreInput = screen.getByPlaceholderText('Search genres...');
    expect(genreInput).toBeInTheDocument();

    // Filter genre list by query
    fireEvent.change(genreInput, { target: { value: 'Action' } });
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.queryByText('Sci-Fi')).not.toBeInTheDocument();

    // Select Action
    await user.click(screen.getByText('Action'));

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    });

    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({})).toEqual({ genre: 'action', page: 1 });
  });

  it('removes genre via badge (x) button or clears all via Clear all button', async () => {
    const { user } = renderSeriesGrid(mockSeriesResponse, {
      page: 2,
      q: undefined,
      genre: 'action,sci-fi',
    });

    expect(screen.getByRole('combobox', { name: 'Filter by genre' })).toHaveTextContent('Genres (2)');
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Sci-Fi')).toBeInTheDocument();

    // Click (x) on Action badge
    const removeActionBtn = screen.getByRole('button', { name: 'Remove Action filter' });
    await user.click(removeActionBtn);

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    });
    const searchFn1 = mockNavigate.mock.calls[0][0].search;
    expect(searchFn1({ genre: 'action,sci-fi', page: 2 })).toEqual({ genre: 'sci-fi', page: 1 });

    mockNavigate.mockReset();

    // Click Clear all
    const clearAllBtn = screen.getByRole('button', { name: 'Clear all' });
    await user.click(clearAllBtn);

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    });
    const searchFn2 = mockNavigate.mock.calls[0][0].search;
    expect(searchFn2({ genre: 'action,sci-fi', page: 2 })).toEqual({ genre: undefined, page: 1 });
  });

  it('renders Edit and Delete buttons on each series card', () => {
    renderSeriesGrid();

    expect(screen.getByRole('button', { name: 'Edit Solo Leveling' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Solo Leveling' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Edit Frieren: Beyond Journey's End" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Delete Frieren: Beyond Journey's End" })).toBeInTheDocument();
  });

  it('opens pre-filled Edit Dialog when clicking Edit button and submits update', async () => {
    const { user } = renderSeriesGrid();

    const editBtn = screen.getByRole('button', { name: 'Edit Solo Leveling' });
    await user.click(editBtn);

    const dialog = screen.getByRole('dialog');
    const dialogWithin = within(dialog);

    expect(dialogWithin.getByRole('heading', { name: 'Edit Series' })).toBeInTheDocument();
    const titleInput = dialogWithin.getByLabelText('Title');
    expect(titleInput).toHaveValue('Solo Leveling');

    const descInput = dialogWithin.getByLabelText('Description');
    expect(descInput).toHaveValue('Sung Jinwoo ascends from E-rank hunter to shadow monarch.');

    // Select genre in multi-select
    const actionGenreBtn = dialogWithin.getByRole('button', { name: 'Action' });
    fireEvent.click(actionGenreBtn);

    fireEvent.change(titleInput, { target: { value: 'Solo Leveling Season 2' } });

    const saveBtn = dialogWithin.getByRole('button', { name: 'Save Changes' });
    await user.click(saveBtn);

    expect(updateSeries).toHaveBeenCalledWith('series-1', {
      title: 'Solo Leveling Season 2',
      description: 'Sung Jinwoo ascends from E-rank hunter to shadow monarch.',
      posterUrl: 'https://example.com/solo-leveling.jpg',
      isFeatured: false,
      isOngoingHighlighted: false,
      genreIds: ['g-1'],
    });
  });

  it('pre-fills assigned genres in Edit Dialog and allows toggling them off', async () => {
    const seriesWithGenresResponse = {
      series: [
        {
          ...mockSeriesResponse.series[0],
          genreIds: ['g-1', 'g-2'],
        },
      ],
      meta: { total: 1, page: 1, limit: 20 },
    };
    const { user } = renderSeriesGrid(seriesWithGenresResponse);

    const editBtn = screen.getByRole('button', { name: 'Edit Solo Leveling' });
    await user.click(editBtn);

    const dialog = screen.getByRole('dialog');
    const dialogWithin = within(dialog);

    const actionGenreBtn = dialogWithin.getByRole('button', { name: 'Action' });
    const sciFiGenreBtn = dialogWithin.getByRole('button', { name: 'Sci-Fi' });

    expect(actionGenreBtn.className).toContain('bg-primary');
    expect(sciFiGenreBtn.className).toContain('bg-primary');

    // Toggle off Sci-Fi
    fireEvent.click(sciFiGenreBtn);

    const saveBtn = dialogWithin.getByRole('button', { name: 'Save Changes' });
    await user.click(saveBtn);

    expect(updateSeries).toHaveBeenCalledWith('series-1', {
      title: 'Solo Leveling',
      description: 'Sung Jinwoo ascends from E-rank hunter to shadow monarch.',
      posterUrl: 'https://example.com/solo-leveling.jpg',
      isFeatured: false,
      isOngoingHighlighted: false,
      genreIds: ['g-1'],
    });
  });

  it('opens Delete Confirmation Dialog and triggers deleteSeries on confirm', async () => {
    const { user } = renderSeriesGrid();

    const deleteBtn = screen.getByRole('button', { name: 'Delete Solo Leveling' });
    await user.click(deleteBtn);

    const dialog = screen.getByRole('dialog');
    const dialogWithin = within(dialog);

    expect(dialogWithin.getByRole('heading', { name: 'Delete Series' })).toBeInTheDocument();
    expect(
      dialogWithin.getByText(/Are you sure you want to delete "Solo Leveling"\?/i)
    ).toBeInTheDocument();

    const confirmDeleteBtn = dialogWithin.getByRole('button', { name: 'Delete' });
    await user.click(confirmDeleteBtn);

    expect(deleteSeries).toHaveBeenCalledWith('series-1');
  });

  it('renders Edit Dialog form fields directly without Tabs wrappers', async () => {
    const { user } = renderSeriesGrid();

    const editBtn = screen.getByRole('button', { name: 'Edit Solo Leveling' });
    await user.click(editBtn);

    const dialog = screen.getByRole('dialog');
    const dialogWithin = within(dialog);

    expect(dialogWithin.getByRole('heading', { name: 'Edit Series' })).toBeInTheDocument();
    expect(dialogWithin.getByLabelText('Title')).toBeInTheDocument();
    expect(dialogWithin.getByLabelText('Description')).toBeInTheDocument();
    expect(dialogWithin.getByLabelText('Poster URL')).toBeInTheDocument();
    expect(dialogWithin.getByLabelText('Featured Series')).toBeInTheDocument();
    expect(dialogWithin.getByText('Genres')).toBeInTheDocument();
    // No Tabs / Relations UI
    expect(dialogWithin.queryByRole('tab')).not.toBeInTheDocument();
    expect(dialogWithin.queryByText('Related Series')).not.toBeInTheDocument();
    expect(dialogWithin.queryByRole('combobox', { name: 'Related Series' })).not.toBeInTheDocument();
  });

  it('renders top-level filter tabs (All, Featured, Ongoing) and indicates active tab', () => {
    renderSeriesGrid();

    const allTab = screen.getByRole('tab', { name: 'All' });
    const featuredTab = screen.getByRole('tab', { name: 'Featured' });
    const ongoingTab = screen.getByRole('tab', { name: 'Ongoing' });

    expect(allTab).toBeInTheDocument();
    expect(featuredTab).toBeInTheDocument();
    expect(ongoingTab).toBeInTheDocument();

    expect(allTab).toHaveAttribute('data-state', 'active');
    expect(featuredTab).toHaveAttribute('data-state', 'inactive');
    expect(ongoingTab).toHaveAttribute('data-state', 'inactive');
  });

  it('switches tab to Featured, updates tab search param, resets page to 1, and preserves q and genre', async () => {
    const { user } = renderSeriesGrid(mockSeriesResponse, {
      page: 3,
      q: 'leveling',
      genre: 'action',
      tab: undefined,
    });

    const featuredTab = screen.getByRole('tab', { name: 'Featured' });
    await user.click(featuredTab);

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    });

    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(
      searchFn({ page: 3, q: 'leveling', genre: 'action', tab: undefined })
    ).toEqual({
      page: 1,
      q: 'leveling',
      genre: 'action',
      tab: 'featured',
    });
  });

  it('switches tab to Ongoing, updates tab search param, resets page to 1, and preserves q and genre', async () => {
    const { user } = renderSeriesGrid(mockSeriesResponse, {
      page: 2,
      q: 'hunter',
      genre: 'action',
      tab: 'featured',
    });

    const ongoingTab = screen.getByRole('tab', { name: 'Ongoing' });
    await user.click(ongoingTab);

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    });

    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(
      searchFn({ page: 2, q: 'hunter', genre: 'action', tab: 'featured' })
    ).toEqual({
      page: 1,
      q: 'hunter',
      genre: 'action',
      tab: 'ongoing',
    });
  });

  it('switches tab to All, clears tab search param, resets page to 1, and preserves q and genre', async () => {
    const { user } = renderSeriesGrid(mockSeriesResponse, {
      page: 2,
      q: 'hunter',
      genre: 'action',
      tab: 'ongoing',
    });

    const allTab = screen.getByRole('tab', { name: 'All' });
    await user.click(allTab);

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    });

    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(
      searchFn({ page: 2, q: 'hunter', genre: 'action', tab: 'ongoing' })
    ).toEqual({
      page: 1,
      q: 'hunter',
      genre: 'action',
      tab: undefined,
    });
  });

  it('renders Featured and Ongoing badges on series cards based on isFeatured and seasons status', () => {
    const badgeResponse = {
      series: [
        {
          ...mockSeriesResponse.series[0],
          isFeatured: true,
          seasons: [{ id: 'sea-1', status: 'ongoing' }],
        },
        mockSeriesResponse.series[1],
      ],
      meta: { total: 2, page: 1, limit: 20 },
    };
    renderSeriesGrid(badgeResponse);

    // Solo Leveling isFeatured: true, has ongoing season -> badges inside card
    const soloCard = screen.getByText('Solo Leveling').closest('.group');
    expect(soloCard).not.toBeNull();
    const soloWithin = within(soloCard as HTMLElement);
    expect(soloWithin.getByText('Featured')).toBeInTheDocument();
    expect(soloWithin.getByText('Ongoing')).toBeInTheDocument();

    // Frieren isFeatured: false, completed season -> should not have badges on its card
    const frierenCard = screen.getByText("Frieren: Beyond Journey's End").closest('.group');
    expect(frierenCard).not.toBeNull();
    const frierenWithin = within(frierenCard as HTMLElement);
    expect(frierenWithin.queryByText('Featured')).not.toBeInTheDocument();
    expect(frierenWithin.queryByText('Ongoing')).not.toBeInTheDocument();
  });

  it('renders accurate total count in filter bar matching backend meta', () => {
    renderSeriesGrid({
      series: mockSeriesResponse.series,
      meta: { total: 42, page: 1, limit: 20 },
    });

    expect(screen.getByText('42 series')).toBeInTheDocument();
  });

  it('does not revert or overwrite typed input when search.q changes from in-flight debounced navigation', () => {
    vi.useFakeTimers();
    const { queryClient, rerender } = renderSeriesGrid(mockSeriesResponse, { page: 1, q: undefined });
    const input = screen.getByPlaceholderText('Filter series...') as HTMLInputElement;

    // User types 'Solo'
    fireEvent.change(input, { target: { value: 'Solo' } });
    expect(input.value).toBe('Solo');

    // Debounce timer fires
    vi.advanceTimersByTime(500);
    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
      replace: true,
    });

    // Before or during route update, user types 'Solo Leveling'
    fireEvent.change(input, { target: { value: 'Solo Leveling' } });
    expect(input.value).toBe('Solo Leveling');

    // Route finishes updating and search.q becomes 'Solo'
    const newSearch = { page: 1, q: 'Solo' };
    queryClient.setQueryData(seriesListQueryOptions(newSearch).queryKey, mockSeriesResponse);
    mockSearchState = newSearch;
    rerender(<SeriesGrid />);

    // Typed input must NOT be reverted to 'Solo'
    expect(input.value).toBe('Solo Leveling');

    vi.useRealTimers();
  });

  it('preserves search input and pending debounce when switching tabs or toggling genres', () => {
    vi.useFakeTimers();
    renderSeriesGrid(mockSeriesResponse, { page: 1, q: undefined, genre: 'sci-fi' });
    const input = screen.getByPlaceholderText('Filter series...') as HTMLInputElement;

    // User types 'hunter'
    fireEvent.change(input, { target: { value: 'hunter' } });

    // User removes genre filter 'sci-fi' at 200ms (timer still pending)
    const removeSciFiBtn = screen.getByRole('button', { name: 'Remove Sci-Fi filter' });
    fireEvent.click(removeSciFiBtn);

    // Genre navigate called
    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    });
    const genreSearchFn = mockNavigate.mock.calls[0][0].search;
    expect(genreSearchFn({ genre: 'sci-fi', page: 1 })).toEqual({ genre: undefined, page: 1 });

    mockNavigate.mockReset();

    // Advance timer to 500ms
    vi.advanceTimersByTime(500);

    // Debounce timer fires with replace: true
    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
      replace: true,
    });

    // The search updater function receives current search state (which has genre cleared)
    const debouncedSearchFn = mockNavigate.mock.calls[0][0].search;
    expect(debouncedSearchFn({ genre: undefined, page: 1 })).toEqual({
      genre: undefined,
      q: 'hunter',
      page: 1,
    });

    vi.useRealTimers();
  });

  it('updates search input when search.q changes externally (e.g. back button navigation)', () => {
    const { queryClient, rerender } = renderSeriesGrid(mockSeriesResponse, { page: 1, q: undefined });
    const input = screen.getByPlaceholderText('Filter series...') as HTMLInputElement;
    expect(input.value).toBe('');

    // External URL change (e.g. Back button)
    const externalSearch = { page: 1, q: 'Frieren' };
    queryClient.setQueryData(seriesListQueryOptions(externalSearch).queryKey, mockSeriesResponse);
    mockSearchState = externalSearch;
    rerender(<SeriesGrid />);

    expect(input.value).toBe('Frieren');
    // Ensure no spurious navigate was called
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
