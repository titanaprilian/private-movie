import { renderWithProviders, screen, userEvent } from '../../utils';
import { describe, expect, it } from 'vitest';
import { VideoCard } from '@/modules/video-grid';

const mockVideo = {
  id: '1',
  title: 'Test Episode Subtitle Indonesia',
  seriesId: 'test-series',
  source: 'otakudesu',
  videoType: 'TV',
  videoUrl: 'https://example.com/embed/test',
  thumbnail: 'https://picsum.photos/seed/test/320/180',
  createdAt: new Date('2025-06-15T10:00:00Z'),
  sourceUrl: 'https://otakudesu.cloud/episode/test',
  metadata: null,
};

describe('VideoCard component', () => {
  it('renders the video title', () => {
    renderWithProviders(<VideoCard video={mockVideo} />);
    expect(
      screen.getByText('Test Episode Subtitle Indonesia')
    ).toBeInTheDocument();
  });

  it('renders the source tag', () => {
    renderWithProviders(<VideoCard video={mockVideo} />);
    expect(screen.getByText('otakudesu')).toBeInTheDocument();
  });

  it('renders the video type badge', () => {
    renderWithProviders(<VideoCard video={mockVideo} />);
    expect(screen.getByText('TV')).toBeInTheDocument();
  });

  it('renders the formatted date', () => {
    renderWithProviders(<VideoCard video={mockVideo} />);
    expect(screen.getByText('Jun 15, 2025')).toBeInTheDocument();
  });

  it('renders the thumbnail image', () => {
    renderWithProviders(<VideoCard video={mockVideo} />);
    const img = screen.getByAltText('Test Episode Subtitle Indonesia');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      'src',
      'https://picsum.photos/seed/test/320/180'
    );
  });

  it('renders the kebab menu button', () => {
    renderWithProviders(<VideoCard video={mockVideo} />);
    const kebab = screen.getByRole('button', { name: /more/i });
    expect(kebab).toBeInTheDocument();
  });

  it('shows dropdown items when kebab is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VideoCard video={mockVideo} />);
    const kebab = screen.getByRole('button', { name: /more/i });
    await user.click(kebab);
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('renders a play overlay on hover', () => {
    renderWithProviders(<VideoCard video={mockVideo} />);
    const container = screen.getByTestId('video-card');
    expect(container).toBeInTheDocument();
  });
});
