import { renderWithProviders, screen, within } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { StorageSeriesTable } from '@/modules/storage/internal/components/StorageSeriesTable';
import type { StorageSeriesItem } from '@/modules/storage';

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
  it('displays the 1-based index in a 40x40 .ep-num tactile badge with blue text', () => {
    renderWithProviders(
      <StorageSeriesTable series={series} onSelectSeries={() => {}} />
    );
    const badge = screen.getByTestId('series-row-index-series-1');
    expect(badge).toHaveClass('ep-num');
    expect(badge).toHaveTextContent('1');
    expect(screen.getByTestId('series-row-index-series-2')).toHaveTextContent('2');
  });

  it('styles rows as .ep cards with 4px bottom border and hover lift effects', () => {
    renderWithProviders(
      <StorageSeriesTable series={series} onSelectSeries={() => {}} />
    );
    const row = screen.getByTestId('series-row-series-1');
    // .ep-equivalent card styling (see apps/web/src/index.css `.ep` rule)
    for (const cls of [
      'bg-[var(--bg)]',
      'border-2',
      'border-b-4',
      'rounded-[var(--radius)]',
      'hover:-translate-y-0.5',
      'hover:border-[#4b5d67]',
      'active:translate-y-0',
    ]) {
      expect(row.className).toContain(cls);
    }
  });

  it('selects the series on row click and on Enter/Space keydown', async () => {
    const onSelectSeries = vi.fn();
    const { user } = renderWithProviders(
      <StorageSeriesTable series={series} onSelectSeries={onSelectSeries} />
    );
    await user.click(screen.getByTestId('series-row-series-1'));
    expect(onSelectSeries).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'series-1' })
    );

    const row = screen.getByTestId('series-row-series-2');
    row.focus();
    await user.keyboard('{Enter}');
    expect(onSelectSeries).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'series-2' })
    );
    await user.keyboard(' ');
    expect(onSelectSeries).toHaveBeenCalledTimes(3);
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
