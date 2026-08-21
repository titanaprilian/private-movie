import { createTestQueryClient, renderWithProviders, screen, fireEvent, within, act } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { SeriesCombobox } from '@/modules/videos/internal/SeriesCombobox';
import { seriesListQueryOptions } from '@/modules/videos/internal/api';

const mockSeriesList = [
  {
    id: 's-1',
    title: 'Attack on Titan',
    source: 'otakudesu',
    sourceUrl: 'https://example.com/aot',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 's-2',
    title: 'Demon Slayer',
    source: 'otakudesu',
    sourceUrl: 'https://example.com/ds',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

describe('SeriesCombobox component', () => {
  it('renders placeholder when no series is selected', () => {
    renderWithProviders(
      <SeriesCombobox value="" onValueChange={vi.fn()} initialSeriesList={mockSeriesList} />
    );

    expect(screen.getByRole('combobox', { name: 'Related Series' })).toHaveTextContent(
      'Select a series...'
    );
  });

  it('renders selected series title when value is matched', () => {
    renderWithProviders(
      <SeriesCombobox
        value="s-2"
        onValueChange={vi.fn()}
        initialSeriesList={mockSeriesList}
      />
    );

    expect(screen.getByRole('combobox', { name: 'Related Series' })).toHaveTextContent(
      'Demon Slayer'
    );
  });

  it('excludes series specified in excludeSeriesId', async () => {
    const { user } = renderWithProviders(
      <SeriesCombobox
        value=""
        onValueChange={vi.fn()}
        excludeSeriesId="s-1"
        initialSeriesList={mockSeriesList}
      />
    );

    const trigger = screen.getByRole('combobox', { name: 'Related Series' });
    await user.click(trigger);

    expect(screen.queryByText('Attack on Titan')).not.toBeInTheDocument();
    expect(screen.getByText('Demon Slayer')).toBeInTheDocument();
  });

  it('calls onValueChange when selecting an option from popover', async () => {
    const handleValueChange = vi.fn();
    const { user } = renderWithProviders(
      <SeriesCombobox
        value=""
        onValueChange={handleValueChange}
        initialSeriesList={mockSeriesList}
      />
    );

    const trigger = screen.getByRole('combobox', { name: 'Related Series' });
    await user.click(trigger);

    const listbox = screen.getByRole('listbox');
    const option = within(listbox).getByText('Attack on Titan');
    fireEvent.click(option);

    expect(handleValueChange).toHaveBeenCalledWith('s-1', expect.objectContaining({ id: 's-1', title: 'Attack on Titan' }));
  });

  it('shows only search results when a search query is active, ignoring un-searched initial series', async () => {
    vi.useFakeTimers();
    const queryClient = createTestQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } });

    const searchResults = [
      {
        id: 's-3',
        title: 'Bye Bye Earth',
        source: 'otakudesu',
        sourceUrl: 'https://example.com/bye',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ];

    queryClient.setQueryData(seriesListQueryOptions({ q: undefined }).queryKey, {
      series: mockSeriesList,
      meta: { total: 2, page: 1, limit: 20 },
    });
    queryClient.setQueryData(seriesListQueryOptions({ q: 'Bye' }).queryKey, {
      series: searchResults,
      meta: { total: 1, page: 1, limit: 20 },
    });

    renderWithProviders(
      <SeriesCombobox
        value=""
        onValueChange={vi.fn()}
        initialSeriesList={mockSeriesList}
      />,
      { queryClient }
    );

    const trigger = screen.getByRole('combobox', { name: 'Related Series' });
    fireEvent.click(trigger);

    const searchInput = screen.getByPlaceholderText('Search series...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Bye' } });
      vi.advanceTimersByTime(350);
    });

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Bye Bye Earth')).toBeInTheDocument();
    expect(within(listbox).queryByText('Attack on Titan')).not.toBeInTheDocument();
    expect(within(listbox).queryByText('Demon Slayer')).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
