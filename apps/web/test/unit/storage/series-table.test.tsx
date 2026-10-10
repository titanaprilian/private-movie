import { renderWithProviders, screen, within } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { StorageSeriesTable } from '@/modules/storage/internal/components/StorageSeriesTable';
import type { StorageSeriesItem } from '@/modules/storage/internal/api';

const mockSeries: StorageSeriesItem[] = [
  {
    id: 'series-1',
    title: 'Cyberpunk Series',
    s3SourceCount: 2,
    s3SizeBytes: 6442450944,
    seasons: [
      {
        id: 'season-1',
        seasonNumber: 1,
        title: 'Season 1',
        s3SourceCount: 2,
        s3SizeBytes: 6442450944,
      },
    ],
  },
  {
    id: 'series-2',
    title: 'Space Odyssey',
    s3SourceCount: 1,
    s3SizeBytes: 1073741824,
    seasons: [
      {
        id: 'season-2',
        seasonNumber: 1,
        title: 'Season 1',
        s3SourceCount: 1,
        s3SizeBytes: 536870912,
      },
      {
        id: 'season-3',
        seasonNumber: 2,
        title: 'Season 2',
        s3SourceCount: 0,
        s3SizeBytes: 536870912,
      },
    ],
  },
];

describe('StorageSeriesTable rows', () => {
  it('renders an index number column header (#)', () => {
    renderWithProviders(
      <StorageSeriesTable series={mockSeries} onSelectSeries={vi.fn()} />
    );
    expect(screen.getByTestId('series-header-index')).toHaveTextContent('#');
  });

  it('displays a 1-based index number badge on each series row', () => {
    renderWithProviders(
      <StorageSeriesTable series={mockSeries} onSelectSeries={vi.fn()} />
    );
    expect(screen.getByTestId('series-row-index-series-1')).toHaveTextContent(
      '1'
    );
    expect(screen.getByTestId('series-row-index-series-2')).toHaveTextContent(
      '2'
    );
  });

  it('renders a trailing triple-dot action menu with an Inspect Storage action on each row', async () => {
    const { user } = renderWithProviders(
      <StorageSeriesTable series={mockSeries} onSelectSeries={vi.fn()} />
    );

    const firstMenu = screen.getByRole('button', {
      name: 'Actions for Cyberpunk Series',
    });
    expect(firstMenu).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Actions for Space Odyssey' })
    ).toBeInTheDocument();

    await user.click(firstMenu);
    expect(
      await screen.findByRole('menuitem', { name: 'Inspect Storage' })
    ).toBeInTheDocument();
  });

  it('invokes series selection when Inspect Storage is clicked', async () => {
    const onSelectSeries = vi.fn();
    const { user } = renderWithProviders(
      <StorageSeriesTable series={mockSeries} onSelectSeries={onSelectSeries} />
    );

    await user.click(
      screen.getByRole('button', { name: 'Actions for Cyberpunk Series' })
    );
    await user.click(
      await screen.findByRole('menuitem', { name: 'Inspect Storage' })
    );

    expect(onSelectSeries).toHaveBeenCalledTimes(1);
    expect(onSelectSeries).toHaveBeenCalledWith(mockSeries[0]);
  });

  it('triggers series selection when clicking anywhere on the row', async () => {
    const onSelectSeries = vi.fn();
    const { user } = renderWithProviders(
      <StorageSeriesTable series={mockSeries} onSelectSeries={onSelectSeries} />
    );

    await user.click(screen.getByTestId('series-row-series-2'));
    expect(onSelectSeries).toHaveBeenCalledTimes(1);
    expect(onSelectSeries).toHaveBeenCalledWith(mockSeries[1]);
  });

  it('does not fire a redundant row click when opening the kebab menu', async () => {
    const onSelectSeries = vi.fn();
    const { user } = renderWithProviders(
      <StorageSeriesTable series={mockSeries} onSelectSeries={onSelectSeries} />
    );

    await user.click(
      screen.getByRole('button', { name: 'Actions for Space Odyssey' })
    );

    // Only the menu opened — the row click handler must not have fired.
    expect(onSelectSeries).not.toHaveBeenCalled();
    expect(
      within(screen.getByTestId('series-row-series-2')).getByRole('button', {
        name: 'Actions for Space Odyssey',
      })
    ).toBeInTheDocument();
  });
});
