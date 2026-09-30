import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it } from 'vitest';
import { StatsRow } from '@/modules/dashboard';

describe('StatsRow', () => {
  it('renders four interactive chunky cards with sentence case labels', () => {
    const { container } = renderWithProviders(
      <StatsRow
        catalog={{
          totalSeries: 12,
          ongoingSeriesCount: 3,
          featuredSeriesCount: 4,
          totalSeasons: 15,
          totalEpisodes: 240,
          totalGenres: 8,
        }}
        storage={{
          totalUsedBytes: 10737418240,
          totalLimitBytes: 107374182400,
          percentUsed: 10,
          providerCount: 2,
        }}
      />
    );
    expect(screen.getByTestId('kpi-total-series')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-total-episodes')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-total-genres')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-storage')).toBeInTheDocument();
    // Interactive hover lift from ChunkyCard
    for (const testId of ['kpi-total-series', 'kpi-total-episodes', 'kpi-total-genres', 'kpi-storage']) {
      expect(screen.getByTestId(testId).className).toContain('hover:-translate-y-[2px]');
    }
    // Sentence case labels (no ALL-CAPS)
    expect(screen.getByText('Total series')).toBeInTheDocument();
    expect(screen.getByText('Total episodes')).toBeInTheDocument();
    expect(screen.getByText('Genres')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/TOTAL SERIES|TOTAL EPISODES|STORAGE USAGE/);
    // Series footer
    expect(screen.getByTestId('kpi-series-footer')).toHaveTextContent('3 ongoing · 4 featured');
  });

  it('shows Not tracked when storage is zero and hides the subtitle', () => {
    renderWithProviders(
      <StatsRow
        catalog={{
          totalSeries: 1,
          ongoingSeriesCount: 0,
          featuredSeriesCount: 0,
          totalSeasons: 1,
          totalEpisodes: 1,
          totalGenres: 1,
        }}
        storage={{ totalUsedBytes: 0, totalLimitBytes: 107374182400, percentUsed: 0, providerCount: 1 }}
      />
    );
    expect(screen.getByTestId('kpi-storage-value')).toHaveTextContent('Not tracked');
    expect(screen.queryByTestId('kpi-storage-percent')).not.toBeInTheDocument();
  });

  it('renders the subtitle when storage is tracked', () => {
    renderWithProviders(
      <StatsRow
        catalog={{
          totalSeries: 1,
          ongoingSeriesCount: 0,
          featuredSeriesCount: 0,
          totalSeasons: 1,
          totalEpisodes: 1,
          totalGenres: 1,
        }}
        storage={{
          totalUsedBytes: 10737418240,
          totalLimitBytes: 107374182400,
          percentUsed: 10,
          providerCount: 1,
        }}
      />
    );
    expect(screen.getByTestId('kpi-storage-value')).toHaveTextContent('10.0 GB');
    expect(screen.getByTestId('kpi-storage-percent')).toHaveTextContent('of 100.0 GB used (10.0%)');
  });

  it('renders subtitles for total episodes and genres matching mockup', () => {
    renderWithProviders(
      <StatsRow
        catalog={{
          totalSeries: 12,
          ongoingSeriesCount: 3,
          featuredSeriesCount: 4,
          totalSeasons: 15,
          totalEpisodes: 240,
          totalGenres: 8,
        }}
      />
    );
    expect(screen.getByTestId('kpi-episodes-footer')).toHaveTextContent('Across 12 series');
    expect(screen.getByTestId('kpi-genres-footer')).toHaveTextContent('Used across the catalog');
  });
});
