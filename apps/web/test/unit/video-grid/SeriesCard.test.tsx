import { renderWithProviders, screen, userEvent } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { SeriesCard } from '@/modules/video-grid';

const mockSeries = {
  id: 'mushoku-tensei',
  title: 'Mushoku Tensei',
  description: 'A 34-year-old NEET dies and is reincarnated into a world of magic.',
  thumbnail: 'https://picsum.photos/seed/mushoku-series/320/180',
  episodeCount: 2,
  source: 'otakudesu',
  genres: ['Fantasy', 'Adventure'],
};

describe('SeriesCard component', () => {
  it('renders the series title', () => {
    renderWithProviders(<SeriesCard series={mockSeries} onClick={() => {}} />);
    expect(screen.getByText('Mushoku Tensei')).toBeInTheDocument();
  });

  it('renders the episode count', () => {
    renderWithProviders(<SeriesCard series={mockSeries} onClick={() => {}} />);
    expect(screen.getByText('2 episodes')).toBeInTheDocument();
  });

  it('renders the source', () => {
    renderWithProviders(<SeriesCard series={mockSeries} onClick={() => {}} />);
    expect(screen.getByText('otakudesu')).toBeInTheDocument();
  });

  it('renders genre badges', () => {
    renderWithProviders(<SeriesCard series={mockSeries} onClick={() => {}} />);
    expect(screen.getByText('Fantasy')).toBeInTheDocument();
    expect(screen.getByText('Adventure')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<SeriesCard series={mockSeries} onClick={onClick} />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});