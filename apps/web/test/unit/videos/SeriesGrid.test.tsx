import { createTestQueryClient, renderWithProviders, screen, fireEvent, within, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  SeriesGrid,
  seriesListQueryOptions,
  updateSeries,
  deleteSeries,
  SERIES_PAGE_LIMIT,
  type SeriesListResponse,
} from '@/modules/videos';
import { genresQueryOptions, type Genre } from '@/modules/genres';
import { useScrapeWorkerStore } from '@/modules/videos/internal/store/useScrapeWorkerStore';

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
    limit: SERIES_PAGE_LIMIT,
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
  queryClient.setQueryData(
    seriesListQueryOptions({ ...searchState, limit: SERIES_PAGE_LIMIT }).queryKey,
    customResponse as SeriesListResponse
  );
  queryClient.setQueryData(genresQueryOptions().queryKey, genresList);
  return renderWithProviders(<SeriesGrid />, { queryClient });
}

describe('SeriesGrid component', () => {
  beforeEach(() => {
    // The embedded AddMediaDialog is a Radix modal: if a previous test leaves
    // the scrape-worker store open, the modal aria-hides the grid content.
    useScrapeWorkerStore.getState().reset();
    useScrapeWorkerStore.setState({ isOpen: false });
  });

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
      meta: { total: 1, page: 1, limit: SERIES_PAGE_LIMIT },
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

    vi.advanceTimersByTime(250);

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
      replace: true,
    });

    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({})).toEqual({ q: 'Solo', page: 1 });

    vi.useRealTimers();
  });

  it('renders chunky pagination bar with Page indicator and disabled Previous on page 1', () => {
    const paginatedResponse = {
      ...mockSeriesResponse,
      meta: {
        total: 25,
        page: 1,
        limit: SERIES_PAGE_LIMIT,
      },
    };
    renderSeriesGrid(paginatedResponse);

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled();
  });

  it('navigates to the next page via chunky Next chip and disables Next on the final page', async () => {
    const { user } = renderSeriesGrid(
      {
        ...mockSeriesResponse,
        meta: { total: 25, page: 3, limit: SERIES_PAGE_LIMIT },
      },
      { page: 3, q: undefined, genre: undefined, tab: undefined }
    );

    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Previous page' }));

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    });
    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({ page: 3 })).toEqual({ page: 2 });
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

  it('renders GenreFilter trigger with empty, single, and multi labels from URL state', () => {
    renderSeriesGrid(mockSeriesResponse, { page: 1, q: undefined, genre: undefined });
    expect(screen.getByRole('combobox', { name: 'Filter by genre' })).toHaveTextContent(
      'Filter by genre'
    );
  });

  it('restores combined URL state (tab, search, genre, page) into toolbar controls', () => {
    renderSeriesGrid(mockSeriesResponse, {
      page: 2,
      q: 'leveling',
      genre: 'action',
      tab: 'featured',
    });

    expect(screen.getByPlaceholderText('Filter series...')).toHaveValue('leveling');
    expect(screen.getByRole('tab', { name: 'Featured' })).toHaveAttribute(
      'data-state',
      'active'
    );
    expect(screen.getByRole('combobox', { name: 'Action' })).toHaveTextContent('Action');
    expect(screen.getByText('2 series')).toBeInTheDocument();
  });

  it('shows multi-genre count label when several genre slugs are in the URL', () => {
    renderSeriesGrid(mockSeriesResponse, {
      page: 1,
      q: undefined,
      genre: 'action,sci-fi',
    });

    expect(screen.getByRole('combobox', { name: '2 genres' })).toHaveTextContent('2 genres');
  });

  it('opens genre popover, filters genres by search, and navigates with multi-select ?genre= value', async () => {
    const { user } = renderSeriesGrid();

    const trigger = screen.getByRole('combobox', { name: 'Filter by genre' });
    expect(trigger).toHaveTextContent('Filter by genre');
    await user.click(trigger);

    const genreInput = screen.getByPlaceholderText('Search genres...');
    expect(genreInput).toBeInTheDocument();

    // Filter genre list by query
    await user.type(genreInput, 'Action');
    expect(screen.getByRole('option', { name: 'Action' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Sci-Fi' })).not.toBeInTheDocument();

    // Select Action
    await user.click(screen.getByRole('option', { name: 'Action' }));

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    });

    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({})).toEqual({ genre: 'action', page: 1 });
  });

  it('clears genre selection via the popover Clear button and resets page to 1', async () => {
    const pagedResponse = {
      ...mockSeriesResponse,
      meta: { total: 25, page: 2, limit: SERIES_PAGE_LIMIT },
    };
    const { user } = renderSeriesGrid(pagedResponse, {
      page: 2,
      q: undefined,
      genre: 'action,sci-fi',
    });

    expect(screen.getByRole('combobox', { name: '2 genres' })).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: '2 genres' }));
    expect(await screen.findByPlaceholderText('Search genres...')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    });
    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({ genre: 'action,sci-fi', page: 2 })).toEqual({ genre: undefined, page: 1 });
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
      logoUrl: null,
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
      meta: { total: 1, page: 1, limit: SERIES_PAGE_LIMIT },
    };
    const { user } = renderSeriesGrid(seriesWithGenresResponse);

    const editBtn = screen.getByRole('button', { name: 'Edit Solo Leveling' });
    await user.click(editBtn);

    const dialog = screen.getByRole('dialog');
    const dialogWithin = within(dialog);

    const actionGenreBtn = dialogWithin.getByRole('button', { name: 'Action' });
    const sciFiGenreBtn = dialogWithin.getByRole('button', { name: 'Sci-Fi' });

    expect(actionGenreBtn).toHaveAttribute('aria-pressed', 'true');
    expect(sciFiGenreBtn).toHaveAttribute('aria-pressed', 'true');
    expect(actionGenreBtn.className).toContain('border-[var(--green)]');
    expect(sciFiGenreBtn.className).toContain('border-[var(--green)]');

    // Toggle off Sci-Fi
    fireEvent.click(sciFiGenreBtn);

    const saveBtn = dialogWithin.getByRole('button', { name: 'Save Changes' });
    await user.click(saveBtn);

    expect(updateSeries).toHaveBeenCalledWith('series-1', {
      title: 'Solo Leveling',
      description: 'Sung Jinwoo ascends from E-rank hunter to shadow monarch.',
      posterUrl: 'https://example.com/solo-leveling.jpg',
      logoUrl: null,
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
    const pagedResponse = {
      ...mockSeriesResponse,
      meta: { total: 25, page: 2, limit: SERIES_PAGE_LIMIT },
    };
    const { user } = renderSeriesGrid(pagedResponse, {
      page: 2,
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
      searchFn({ page: 2, q: 'leveling', genre: 'action', tab: undefined })
    ).toEqual({
      page: 1,
      q: 'leveling',
      genre: 'action',
      tab: 'featured',
    });
  });

  it('switches tab to Ongoing, updates tab search param, resets page to 1, and preserves q and genre', async () => {
    const pagedResponse = {
      ...mockSeriesResponse,
      meta: { total: 25, page: 2, limit: SERIES_PAGE_LIMIT },
    };
    const { user } = renderSeriesGrid(pagedResponse, {
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
    const pagedResponse = {
      ...mockSeriesResponse,
      meta: { total: 25, page: 2, limit: SERIES_PAGE_LIMIT },
    };
    const { user } = renderSeriesGrid(pagedResponse, {
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
      meta: { total: 2, page: 1, limit: SERIES_PAGE_LIMIT },
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
      meta: { total: 42, page: 1, limit: SERIES_PAGE_LIMIT },
    });

    expect(screen.getByText('42 series')).toBeInTheDocument();
  });

  it('hides pagination and shows empty state when no series match the filter', () => {
    renderSeriesGrid({
      series: [],
      meta: { total: 0, page: 1, limit: SERIES_PAGE_LIMIT },
    });

    expect(screen.getByText('No series match your filter.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('series-grid')).not.toBeInTheDocument();
  });

  it('clamps out-of-bounds page params back to the last valid page', () => {
    renderSeriesGrid(
      {
        series: mockSeriesResponse.series,
        meta: { total: 2, page: 5, limit: SERIES_PAGE_LIMIT },
      },
      { page: 5, q: undefined, genre: undefined, tab: undefined }
    );

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
      replace: true,
    });
    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({ page: 5 })).toEqual({ page: 1 });
  });

  it('steps back to page - 1 when deleting the sole item on page > 1', async () => {
    const { user } = renderSeriesGrid(
      {
        series: [mockSeriesResponse.series[0]],
        meta: { total: 13, page: 2, limit: SERIES_PAGE_LIMIT },
      },
      { page: 2, q: undefined, genre: undefined, tab: undefined }
    );

    await user.click(screen.getByRole('button', { name: 'Delete Solo Leveling' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteSeries).toHaveBeenCalledWith('series-1'));

    const navigations = mockNavigate.mock.calls.map((call) => call[0].search({ page: 2 }));
    expect(navigations).toContainEqual({ page: 1 });
  });

  it('preserves pagination page and filters when toggling the featured star', async () => {
    const pagedResponse = {
      ...mockSeriesResponse,
      meta: { total: 25, page: 2, limit: SERIES_PAGE_LIMIT },
    };
    const { user } = renderSeriesGrid(pagedResponse, {
      page: 2,
      q: 'leveling',
      genre: 'action',
      tab: undefined,
    });

    await user.click(
      screen.getByRole('button', { name: 'Mark Solo Leveling as featured' })
    );

    await waitFor(() =>
      expect(updateSeries).toHaveBeenCalledWith('series-1', { isFeatured: true })
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not revert or overwrite typed input when search.q changes from in-flight debounced navigation', () => {
    vi.useFakeTimers();
    const { queryClient, rerender } = renderSeriesGrid(mockSeriesResponse, { page: 1, q: undefined });
    const input = screen.getByPlaceholderText('Filter series...') as HTMLInputElement;

    // User types 'Solo'
    fireEvent.change(input, { target: { value: 'Solo' } });
    expect(input.value).toBe('Solo');

    // Debounce timer fires
    vi.advanceTimersByTime(250);
    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
      replace: true,
    });

    // Before or during route update, user types 'Solo Leveling'
    fireEvent.change(input, { target: { value: 'Solo Leveling' } });
    expect(input.value).toBe('Solo Leveling');

    // Route finishes updating and search.q becomes 'Solo'
    const newSearch = { page: 1, q: 'Solo' };
    queryClient.setQueryData(
      seriesListQueryOptions({ ...newSearch, limit: SERIES_PAGE_LIMIT }).queryKey,
      mockSeriesResponse
    );
    mockSearchState = newSearch;
    rerender(<SeriesGrid />);

    // Typed input must NOT be reverted to 'Solo'
    expect(input.value).toBe('Solo Leveling');

    vi.useRealTimers();
  });

  it('preserves search input and pending debounce when switching tabs', async () => {
    const pagedResponse = {
      ...mockSeriesResponse,
      meta: { total: 25, page: 1, limit: SERIES_PAGE_LIMIT },
    };
    const { user } = renderSeriesGrid(pagedResponse, { page: 1, q: undefined, genre: 'sci-fi' });
    const input = screen.getByPlaceholderText('Filter series...') as HTMLInputElement;

    // User types 'hunter'
    await user.type(input, 'hunter');
    expect(input).toHaveValue('hunter');

    // User switches to the Featured tab while the debounce is pending
    await user.click(screen.getByRole('tab', { name: 'Featured' }));

    // Tab navigate called (page reset, filters preserved)
    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    });
    const tabSearchFn = mockNavigate.mock.calls[0][0].search;
    expect(
      tabSearchFn({ genre: 'sci-fi', page: 1, tab: undefined })
    ).toEqual({ genre: 'sci-fi', page: 1, tab: 'featured' });

    // Debounce fires after typing settles, spreading current search state
    await waitFor(() => {
      const replaceCalls = mockNavigate.mock.calls.filter((call) => call[0].replace);
      expect(replaceCalls.length).toBeGreaterThan(0);
    });
    const replaceCalls = mockNavigate.mock.calls.filter((call) => call[0].replace);
    const debouncedSearchFn = replaceCalls[0][0].search;
    expect(debouncedSearchFn({ genre: 'sci-fi', page: 1, tab: 'featured' })).toEqual({
      genre: 'sci-fi',
      page: 1,
      tab: 'featured',
      q: 'hunter',
    });
  });

  it('renders centered pagination nav with chevron icons and accessible labels', () => {
    const paginatedResponse = {
      ...mockSeriesResponse,
      meta: { total: 25, page: 1, limit: SERIES_PAGE_LIMIT },
    };
    renderSeriesGrid(paginatedResponse);

    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(nav.tagName).toBe('NAV');
    expect(nav.className).toContain('mt-7');
    expect(nav.className).toContain('flex');
    expect(nav.className).toContain('items-center');
    expect(nav.className).toContain('justify-center');
    expect(nav.className).toContain('gap-4');

    const prevBtn = screen.getByRole('button', { name: 'Previous page' });
    const nextBtn = screen.getByRole('button', { name: 'Next page' });
    expect(prevBtn).toHaveTextContent('Previous');
    expect(nextBtn).toHaveTextContent('Next');
    // Lucide chevron icons render as svg inside each button
    expect(prevBtn.querySelector('svg')).not.toBeNull();
    expect(nextBtn.querySelector('svg')).not.toBeNull();

    // Chevron order: leading icon on Previous, trailing icon on Next
    const prevChildren = Array.from(prevBtn.childNodes);
    const prevSvgIndex = prevChildren.findIndex(
      (n) => n instanceof Element && n.tagName.toLowerCase() === 'svg'
    );
    expect(prevSvgIndex).toBe(0);
    const nextChildren = Array.from(nextBtn.childNodes);
    const nextSvgIndex = nextChildren.findIndex(
      (n) => n instanceof Element && n.tagName.toLowerCase() === 'svg'
    );
    expect(nextSvgIndex).toBe(nextChildren.length - 1);

    // Center indicator typography
    const indicator = screen.getByText('Page 1 of 3');
    expect(indicator).toHaveAttribute('aria-live', 'polite');
    expect(indicator.className).toContain('font-extrabold');
    expect(indicator.className).toContain('text-[14px]');
    expect(indicator.className).toContain('min-w-[120px]');
    expect(indicator.className).toContain('text-center');
  });

  it('suppresses press physics and dims boundary pagination buttons', () => {
    const paginatedResponse = {
      ...mockSeriesResponse,
      meta: { total: 25, page: 1, limit: SERIES_PAGE_LIMIT },
    };
    renderSeriesGrid(paginatedResponse);

    const prevBtn = screen.getByRole('button', { name: 'Previous page' });
    expect(prevBtn).toBeDisabled();
    expect(prevBtn.className).toContain('disabled:opacity-40');
    expect(prevBtn.className).toContain('disabled:cursor-not-allowed');
    expect(prevBtn.className).toContain('disabled:active:translate-y-0');
  });

  it('scrolls back to the first row of the grid when changing pages', async () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    const { user } = renderSeriesGrid(
      {
        ...mockSeriesResponse,
        meta: { total: 25, page: 3, limit: SERIES_PAGE_LIMIT },
      },
      { page: 3, q: undefined, genre: undefined, tab: undefined }
    );

    await user.click(screen.getByRole('button', { name: 'Previous page' }));

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
  });

  it('updates search input when search.q changes externally (e.g. back button navigation)', () => {
    const { queryClient, rerender } = renderSeriesGrid(mockSeriesResponse, { page: 1, q: undefined });
    const input = screen.getByPlaceholderText('Filter series...') as HTMLInputElement;
    expect(input.value).toBe('');

    // External URL change (e.g. Back button)
    const externalSearch = { page: 1, q: 'Frieren' };
    queryClient.setQueryData(
      seriesListQueryOptions({ ...externalSearch, limit: SERIES_PAGE_LIMIT }).queryKey,
      mockSeriesResponse
    );
    mockSearchState = externalSearch;
    rerender(<SeriesGrid />);

    expect(input.value).toBe('Frieren');
    // Ensure no spurious navigate was called
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
