import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { Route as ImportedRoute } from '@/routes/videos.$seriesId';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
}));

interface RouteMock {
  useParams: () => { seriesId: string };
  component: React.FC;
}

const Route = ImportedRoute as unknown as RouteMock;

describe('videos/$seriesId route component', () => {
  it('renders SeriesDetailView for the resolved seriesId', () => {
    Route.useParams = vi.fn().mockReturnValue({ seriesId: 'deep-modules' });

    const Page = Route.component;
    renderWithProviders(<Page />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Deep Modules' })
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Intro to Deep Modules').length
    ).toBeGreaterThan(0);
  });
});
