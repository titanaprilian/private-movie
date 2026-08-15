import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it } from 'vitest';
import { VideoGrid } from '@/modules/video-grid';

describe('VideoGrid component', () => {
  it('renders the page heading', () => {
    renderWithProviders(<VideoGrid />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Videos' })
    ).toBeInTheDocument();
  });

  it('renders the Add Video button', () => {
    renderWithProviders(<VideoGrid />);
    expect(
      screen.getByRole('button', { name: /add video/i })
    ).toBeInTheDocument();
  });

  it('renders the filter bar with placeholder inputs', () => {
    renderWithProviders(<VideoGrid />);
    expect(screen.getByPlaceholderText('Search videos…')).toBeInTheDocument();
    expect(screen.getByText('All sources')).toBeInTheDocument();
  });

  it('renders video cards for each dummy video', () => {
    renderWithProviders(<VideoGrid />);
    const cards = screen.getAllByTestId('video-card');
    expect(cards.length).toBeGreaterThanOrEqual(8);
  });
});
