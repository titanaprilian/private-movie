import { renderWithProviders, screen, within } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StorageSeriesTable } from '@/modules/storage/internal/components/StorageSeriesTable';
import type { StorageSeriesItem } from '@/modules/storage';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
}));

const series: StorageSeriesItem[] = [
  {
    id: 'series-1',
    title: 'Cyberpunk Series',
    s3SourceCount: 2,
    s3SizeBytes: 6442450944,
    seasons: [
      { id: 'season-1', seasonNumber: 1, title: 'Season 1', s3SourceCount: 1, s3SizeBytes: 100 },
    ],
  } as StorageSeriesItem,
  {
    id: 'series-2',
    title: 'Cozy Mysteries',
    s3SourceCount: 1,
    s3SizeBytes: 1073741824,
    seasons: [],
  } as StorageSeriesItem,
];

describe('StorageSeriesTable episode styling', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('displays the 1-based index in a ChunkyTableIndexBadge', () => {
    renderWithProviders(
      <StorageSeriesTable series={series} onSelectSeries={() => {}} />
    );
    const badge = screen.getByTestId('series-row-index-series-1');
    expect(badge).toHaveClass('ep-num');
    expect(badge).toHaveTextContent('1');
    expect(screen.getByTestId('series-row-index-series-2')).toHaveTextContent('2');
  });

  it('styles rows as interactive ChunkyTableRow cards with hover lift effects', () => {
    renderWithProviders(
      <StorageSeriesTable series={series} onSelectSeries={() => {}} />
    );
    const row = screen.getByTestId('series-row-series-1');
    // Composable chunky table row styling (see chunky-table.tsx ChunkyTableRow)
    for (const cls of [
      'bg-[var(--bg)]',
      'border-2',
      'border-b-4',
      'rounded-2xl',
      'cursor-pointer',
      'hover:-translate-y-[2px]',
      'hover:shadow-lg',
    ]) {
      expect(row.className).toContain(cls);
    }
  });

  it('notifies selection on row click without navigating directly (parent owns navigation)', async () => {
    const onSelectSeries = vi.fn();
    const { user } = renderWithProviders(
      <StorageSeriesTable series={series} onSelectSeries={onSelectSeries} />
    );
    await user.click(screen.getByTestId('series-row-series-1'));
    expect(onSelectSeries).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'series-1' })
    );
    // Deduplicated navigation: the table never calls the router itself.
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('selects the series on Enter/Space keydown', async () => {
    const onSelectSeries = vi.fn();
    const { user } = renderWithProviders(
      <StorageSeriesTable series={series} onSelectSeries={onSelectSeries} />
    );
    const row = screen.getByTestId('series-row-series-2');
    row.focus();
    await user.keyboard('{Enter}');
    expect(onSelectSeries).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'series-2' })
    );
    await user.keyboard(' ');
    expect(onSelectSeries).toHaveBeenCalledTimes(2);
  });

  it('keeps the trailing action menu with an operational "Inspect Storage" action', async () => {
    const onSelectSeries = vi.fn();
    const { user } = renderWithProviders(
      <StorageSeriesTable series={series} onSelectSeries={onSelectSeries} />
    );
    await user.click(
      screen.getByRole('button', { name: 'Actions for Cyberpunk Series' })
    );
    const menu = await screen.findByRole('menu');
    const item = within(menu).getByRole('menuitem', { name: 'Inspect Storage' });
    await user.click(item);
    expect(onSelectSeries).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'series-1' })
    );
    // Only the menu action fired, not the row click handler.
    expect(onSelectSeries).toHaveBeenCalledTimes(1);
  });
});
