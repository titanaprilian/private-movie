import { createTestQueryClient, renderWithProviders, screen, fireEvent, within } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { SeriesGrid, seriesListQueryOptions, updateSeries, deleteSeries } from '@/modules/videos';
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
let mockSearchState: { page?: number; q?: string; genre?: string } = {
  page: 1,
  q: undefined,
  genre: undefined,
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
  { id: 'g-1', name: 'Action', slug: 'action' },
  { id: 'g-2', name: 'Sci-Fi', slug: 'sci-fi' },
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
  searchState: { page?: number; q?: string; genre?: string } = {
    page: 1,
    q: undefined,
    genre: undefined,
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
  queryClient.setQueryData(seriesListQueryOptions(searchState).queryKey, customResponse);
  queryClient.setQueryData(genresQueryOptions().queryKey, genresList);
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

  it('renders genre pills and highlights active genre matched from URL state', () => {
    renderSeriesGrid(mockSeriesResponse, { page: 1, q: undefined, genre: 'sci-fi' });

    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();

    const sciFiBtn = screen.getByRole('button', { name: 'Sci-Fi' });
    expect(sciFiBtn).toBeInTheDocument();
    expect(sciFiBtn.className).toContain('bg-primary');
  });

  it('navigates with ?genre= when clicking an unselected genre pill', async () => {
    const { user } = renderSeriesGrid();

    const sciFiBtn = screen.getByRole('button', { name: 'Sci-Fi' });
    await user.click(sciFiBtn);

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    });

    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({})).toEqual({ genre: 'sci-fi', page: 1 });
  });

  it('removes ?genre= search param when clicking an already selected genre pill or All pill', async () => {
    const { user } = renderSeriesGrid(mockSeriesResponse, {
      page: 1,
      q: undefined,
      genre: 'sci-fi',
    });

    const sciFiBtn = screen.getByRole('button', { name: 'Sci-Fi' });
    await user.click(sciFiBtn);

    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    });

    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({ genre: 'sci-fi' })).toEqual({ genre: undefined, page: 1 });
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
      genreIds: ['g-1'],
      relations: [],
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
      genreIds: ['g-1'],
      relations: [],
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

  it('renders Details and Relations tabs in Edit Dialog and allows switching between them', async () => {
    const { user } = renderSeriesGrid();

    const editBtn = screen.getByRole('button', { name: 'Edit Solo Leveling' });
    await user.click(editBtn);

    const dialog = screen.getByRole('dialog');
    const dialogWithin = within(dialog);

    const detailsTab = dialogWithin.getByRole('tab', { name: 'Details' });
    const relationsTab = dialogWithin.getByRole('tab', { name: 'Relations' });

    expect(detailsTab).toBeInTheDocument();
    expect(relationsTab).toBeInTheDocument();

    // Details tab active by default
    expect(dialogWithin.getByLabelText('Title')).toBeInTheDocument();

    // Switch to Relations tab
    await user.click(relationsTab);
    expect(dialogWithin.getByRole('combobox', { name: 'Related Series' })).toBeInTheDocument();
  });

  it('pre-fills assigned relations in Edit Dialog and allows adding and deleting relation edges before submitting', async () => {
    const seriesWithRelationsResponse = {
      series: [
        {
          ...mockSeriesResponse.series[0],
          relations: [
            {
              relatedSeriesId: 'series-2',
              relationType: 'sequel',
              title: "Frieren: Beyond Journey's End",
            },
          ],
        },
        mockSeriesResponse.series[1],
      ],
      meta: { total: 2, page: 1, limit: 20 },
    };
    const { user } = renderSeriesGrid(seriesWithRelationsResponse);

    const editBtn = screen.getByRole('button', { name: 'Edit Solo Leveling' });
    await user.click(editBtn);

    const dialog = screen.getByRole('dialog');
    const dialogWithin = within(dialog);

    // Switch to Relations tab
    const relationsTab = dialogWithin.getByRole('tab', { name: 'Relations' });
    await user.click(relationsTab);

    // Verify existing relation is displayed
    expect(dialogWithin.getByText("Frieren: Beyond Journey's End")).toBeInTheDocument();
    expect(dialogWithin.getByText('sequel')).toBeInTheDocument();

    // Delete existing relation edge
    const deleteEdgeBtn = dialogWithin.getByRole('button', { name: /remove relation/i });
    await user.click(deleteEdgeBtn);

    // After deleting, relationship title should not be in the assigned list
    expect(dialogWithin.queryByText('sequel')).not.toBeInTheDocument();

    // Open Combobox for Related Series
    const comboboxTrigger = dialogWithin.getByRole('combobox', { name: 'Related Series' });
    await user.click(comboboxTrigger);

    // Select series option in combobox popover
    const listbox = screen.getByRole('listbox');
    const comboboxOption = within(listbox).getByText("Frieren: Beyond Journey's End");
    fireEvent.click(comboboxOption);

    const relationTypeInput = dialogWithin.getByLabelText(/relation type/i);
    fireEvent.change(relationTypeInput, { target: { value: 'prequel' } });

    const addRelationBtn = dialogWithin.getByRole('button', { name: /add relation/i });
    await user.click(addRelationBtn);

    // Verify new relation edge appears in temporary list
    expect(dialogWithin.getByText("Frieren: Beyond Journey's End")).toBeInTheDocument();
    expect(dialogWithin.getByText('prequel')).toBeInTheDocument();

    // Submit changes
    const saveBtn = dialogWithin.getByRole('button', { name: 'Save Changes' });
    await user.click(saveBtn);

    expect(updateSeries).toHaveBeenCalledWith('series-1', {
      title: 'Solo Leveling',
      description: 'Sung Jinwoo ascends from E-rank hunter to shadow monarch.',
      posterUrl: 'https://example.com/solo-leveling.jpg',
      genreIds: [],
      relations: [
        {
          relatedSeriesId: 'series-2',
          relationType: 'prequel',
        },
      ],
    });
  });
});
