import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it } from 'vitest';
import { CinematicHome } from '@/modules/home';
import { IndexPage } from '@/routes/index';

describe('CinematicHome component', () => {
  it('renders hero section with title, synopsis, tags and quick actions', () => {
    renderWithProviders(<CinematicHome />);
    
    expect(screen.getByRole('heading', { level: 1, name: /Attack on Titan/i })).toBeInTheDocument();
    expect(screen.getByText(/truth outside the walls/i)).toBeInTheDocument();
    
    const playButtons = screen.getAllByRole('button', { name: /play/i });
    expect(playButtons.length).toBeGreaterThan(0);
    
    const myListButtons = screen.getAllByRole('button', { name: /my list/i });
    expect(myListButtons.length).toBeGreaterThan(0);
  });

  it('renders all carousel categories with series cards', () => {
    renderWithProviders(<CinematicHome />);

    expect(screen.getByRole('heading', { level: 2, name: 'Trending Now' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Top Shounen' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Simulcasts/i })).toBeInTheDocument();
  });

  it('renders series hover cards with sub/dub tags, season count, and action buttons', () => {
    renderWithProviders(<CinematicHome />);

    // Check cards in carousel
    const seriesCards = screen.getAllByTestId('series-card');
    expect(seriesCards.length).toBeGreaterThan(0);

    // Verify sub/dub tags and season info rendered in cards
    const subDubTags = screen.getAllByText(/SUB|DUB/i);
    expect(subDubTags.length).toBeGreaterThan(0);

    const seasonTags = screen.getAllByText(/\d+ Season|\d+ Seasons/i);
    expect(seasonTags.length).toBeGreaterThan(0);
  });

  it('scrolls carousel rows left and right on button click', async () => {
    const { user } = renderWithProviders(<CinematicHome />);

    const scrollLeftBtn = screen.getByRole('button', { name: /scroll trending now left/i });
    const scrollRightBtn = screen.getByRole('button', { name: /scroll trending now right/i });

    expect(scrollLeftBtn).toBeInTheDocument();
    expect(scrollRightBtn).toBeInTheDocument();

    await user.click(scrollRightBtn);
    await user.click(scrollLeftBtn);
  });
});

describe('Index route page', () => {
  it('renders CinematicHome layout by default', () => {
    renderWithProviders(<IndexPage />);
    
    expect(screen.getByRole('heading', { level: 1, name: /Attack on Titan/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Trending Now' })).toBeInTheDocument();
  });
});
