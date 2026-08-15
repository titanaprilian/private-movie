import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it } from 'vitest';
import { VideoList } from '@/modules/videos';

describe('VideoList component', () => {
  it('renders page heading, add video button and filter placeholder', () => {
    renderWithProviders(<VideoList />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Videos' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add Video' })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filter videos...')).toBeInTheDocument();
  });

  it('renders dense table headers for title, source and date', () => {
    renderWithProviders(<VideoList />);

    expect(screen.getByText('Title ↕')).toBeInTheDocument();
    expect(screen.getByText('Source ↕')).toBeInTheDocument();
    expect(screen.getByText('Date ↕')).toBeInTheDocument();
  });

  it('renders dummy video rows with thumbnails, titles, source and date', () => {
    renderWithProviders(<VideoList />);

    expect(screen.getByText('Sunset Reel')).toBeInTheDocument();
    expect(screen.getByText('Mountain Drone')).toBeInTheDocument();
    expect(screen.getByText('City Timelapse')).toBeInTheDocument();

    expect(screen.getAllByText('YouTube')).toHaveLength(3);
    expect(screen.getAllByText('Vimeo')).toHaveLength(2);
  });

  it('renders per-row action buttons for edit, delete and play', () => {
    renderWithProviders(<VideoList />);

    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: 'Play' })).toHaveLength(5);
  });
});
