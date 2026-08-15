import { createTestQueryClient, renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { SeriesGrid, seriesListQueryOptions } from '@/modules/videos';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
    onClick?: () => void;
  }) => {
    const href = params ? to.replace('$seriesId', params.seriesId) : to;
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  },
  useNavigate: () => vi.fn(),
}));

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

function renderSeriesGrid() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(seriesListQueryOptions().queryKey, mockSeriesResponse);
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

  it('filters series cards when typing in filter input', async () => {
    const { user } = renderSeriesGrid();

    const input = screen.getByPlaceholderText('Filter series...');
    await user.type(input, 'Solo');

    expect(screen.getByText('Solo Leveling')).toBeInTheDocument();
    expect(screen.queryByText('Frieren: Beyond Journey\'s End')).not.toBeInTheDocument();
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
});
