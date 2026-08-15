import { createTestQueryClient, renderWithProviders, screen } from '../../utils';
import { describe, expect, it } from 'vitest';
import { VideoList, episodesQueryOptions } from '@/modules/videos';

const mockEpisodesResponse = {
  episodes: [
    {
      id: '1',
      title: 'Sunset Reel',
      source: 'otakudesu',
      sourceUrl: 'https://otakudesu.cloud/ep1',
      videoUrl: 'https://stream.com/1.mp4',
      createdAt: '2025-01-12T00:00:00.000Z',
      updatedAt: '2025-01-12T00:00:00.000Z',
    },
    {
      id: '2',
      title: 'Mountain Drone',
      source: 'otakudesu',
      sourceUrl: 'https://otakudesu.cloud/ep2',
      videoUrl: 'https://stream.com/2.mp4',
      createdAt: '2025-01-10T00:00:00.000Z',
      updatedAt: '2025-01-10T00:00:00.000Z',
    },
    {
      id: '3',
      title: 'City Timelapse',
      source: 'otakudesu',
      sourceUrl: 'https://otakudesu.cloud/ep3',
      videoUrl: 'https://stream.com/3.mp4',
      createdAt: '2025-01-08T00:00:00.000Z',
      updatedAt: '2025-01-08T00:00:00.000Z',
    },
  ],
  meta: {
    total: 3,
    page: 1,
    limit: 20,
  },
};

function renderVideoList() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(episodesQueryOptions().queryKey, mockEpisodesResponse);
  return renderWithProviders(<VideoList />, { queryClient });
}

describe('VideoList component', () => {
  it('renders page heading, add video button and filter placeholder', () => {
    renderVideoList();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Videos' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add Video' })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filter videos...')).toBeInTheDocument();
  });

  it('renders dense table headers for title, source and date', () => {
    renderVideoList();

    expect(screen.getByText('Title ↕')).toBeInTheDocument();
    expect(screen.getByText('Source ↕')).toBeInTheDocument();
    expect(screen.getByText('Date ↕')).toBeInTheDocument();
  });

  it('renders video rows from query cache with thumbnails, titles, source and date', () => {
    renderVideoList();

    expect(screen.getByText('Sunset Reel')).toBeInTheDocument();
    expect(screen.getByText('Mountain Drone')).toBeInTheDocument();
    expect(screen.getByText('City Timelapse')).toBeInTheDocument();

    expect(screen.getAllByText('otakudesu')).toHaveLength(3);
    expect(screen.getByText('2025-01-12')).toBeInTheDocument();
  });

  it('filters video rows when typing in filter input', async () => {
    const { user } = renderVideoList();

    const input = screen.getByPlaceholderText('Filter videos...');
    await user.type(input, 'Sunset');

    expect(screen.getByText('Sunset Reel')).toBeInTheDocument();
    expect(screen.queryByText('Mountain Drone')).not.toBeInTheDocument();
  });

  it('renders per-row action buttons for edit, delete and play', () => {
    renderVideoList();

    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Play' })).toHaveLength(3);
  });

  it('opens AddMediaDialog when Add Video button is clicked', async () => {
    const { user } = renderVideoList();

    const addBtn = screen.getByRole('button', { name: 'Add Video' });
    await user.click(addBtn);

    expect(screen.getByText('Add Media Wizard')).toBeInTheDocument();
  });
});
