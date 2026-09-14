import { renderWithProviders, screen } from '../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route as ImportedRoute } from '@/routes/watch.$seriesId';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

interface RouteMock {
  validateSearch?: (search: Record<string, unknown>) => { ep?: string };
  useParams: () => { seriesId: string };
  useSearch: () => { ep?: string };
  useLoaderData: () => unknown;
  component: React.FC;
}

const Route = ImportedRoute as unknown as RouteMock;

describe('watch/$seriesId route search params validation & component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates optional ep query param schema', () => {
    const validate = Route.validateSearch;
    expect(validate).toBeDefined();
    if (validate) {
      expect(validate({})).toEqual({});
      expect(validate({ ep: undefined })).toEqual({});
      expect(validate({ ep: 'ep-123' })).toEqual({ ep: 'ep-123' });
      expect(() => validate({ ep: 123 as unknown as string })).toThrow();
    }
  });

  it('renders WatchSeriesPage component in overview mode when ep is absent', () => {
    Route.useParams = vi.fn().mockReturnValue({ seriesId: 'series-123' });
    Route.useSearch = vi.fn().mockReturnValue({});
    Route.useLoaderData = vi.fn().mockReturnValue({
      id: 'series-123',
      title: 'Route Test Series',
      description: 'Overview description',
      seasons: [],
      episodes: [],
    });

    const Page = Route.component;
    renderWithProviders(<Page />);

    expect(screen.getByTestId('series-hero-banner')).toBeInTheDocument();
    expect(screen.getByText('Route Test Series')).toBeInTheDocument();
    expect(screen.getByText('Overview description')).toBeInTheDocument();
  });
});
