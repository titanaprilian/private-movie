import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it } from 'vitest';
import { SeriesCatalog } from '@/modules/video-grid';

describe('SeriesCatalog component', () => {
  it('renders the page heading', () => {
    renderWithProviders(<SeriesCatalog onNavigate={() => {}} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Series' })
    ).toBeInTheDocument();
  });

  it('renders series cards for each dummy series', () => {
    renderWithProviders(<SeriesCatalog onNavigate={() => {}} />);
    const cards = screen.getAllByTestId('series-card');
    expect(cards.length).toBeGreaterThanOrEqual(8);
  });
});