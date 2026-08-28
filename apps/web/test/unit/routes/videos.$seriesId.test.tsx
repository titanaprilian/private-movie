import { renderWithProviders, screen } from '../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route as ImportedRoute } from '@/routes/admin/videos.$seriesId';
import { setAccessToken } from '@/lib/api';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
  useNavigate: () => vi.fn(),
}));

interface RouteMock {
  useParams: () => { seriesId: string };
  useSearch: () => { order?: number };
  component: React.FC;
}

const Route = ImportedRoute as unknown as RouteMock;

describe('videos/$seriesId route component', () => {
  beforeEach(() => {
    setAccessToken('test-token');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/deep-modules')) {
        return new Response(
          JSON.stringify({
            data: {
              id: 'deep-modules',
              sourceUrl: 'https://otakudesu.cloud/anime/deep-modules',
              source: 'otakudesu',
              title: 'Deep Modules',
              description: 'Architecture playlist',
              episodes: [
                {
                  id: 'dm-01',
                  sourceUrl: 'https://otakudesu.cloud/dm-01',
                  source: 'otakudesu',
                  title: 'Intro to Deep Modules',
                  videoSources: [
                    {
                      id: 'vs-1',
                      type: 'direct',
                      url: 'https://stream.com/1.mp4',
                      label: 'Server 1',
                    },
                  ],
                  createdAt: '2026-08-10',
                  updatedAt: '2026-08-10',
                },
              ],
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  it('renders SeriesDetailView for the resolved seriesId', async () => {
    Route.useParams = vi.fn().mockReturnValue({ seriesId: 'deep-modules' });
    Route.useSearch = vi.fn().mockReturnValue({ order: undefined });

    const Page = Route.component;
    renderWithProviders(<Page />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Deep Modules' })
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Intro to Deep Modules').length
    ).toBeGreaterThan(0);
  });
});
