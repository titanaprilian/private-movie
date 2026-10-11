import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setAccessToken } from '@/lib/api';
import { StorageView } from '@/modules/storage';

// Mock TanStack Router — single navigate spy proves deduplicated navigation.
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
}));

const mockSeriesResponse = {
  items: [
    {
      id: 'series-1',
      title: 'Cyberpunk Series',
      s3SourceCount: 2,
      s3SizeBytes: 6442450944,
      seasons: [
        {
          id: 'season-1',
          seasonNumber: 1,
          title: 'Season 1',
          s3SourceCount: 2,
          s3SizeBytes: 6442450944,
        },
      ],
    },
  ],
  total: 1,
};

const mockProviders = [
  {
    id: 'prov-1',
    name: 'Backblaze B2 Main',
    providerType: 'backblaze',
    endpoint: 'https://s3.us-west-002.backblazeb2.com',
    region: 'us-west-002',
    bucket: 'main-bucket',
    accessKeyIdMasked: '••••1234',
    publicBaseUrl: null,
    forcePathStyle: false,
    storageLimitGb: 50,
    isDefault: true,
    isEnabled: true,
    linkedSourcesCount: 2,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'prov-2',
    name: 'Cloudflare R2 Secondary',
    providerType: 'cloudflare_r2',
    endpoint: 'https://account.r2.cloudflarestorage.com',
    region: 'auto',
    bucket: 'r2-bucket',
    accessKeyIdMasked: '••••5678',
    publicBaseUrl: null,
    forcePathStyle: false,
    storageLimitGb: 100,
    isDefault: false,
    isEnabled: true,
    linkedSourcesCount: 0,
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  },
];

function mockFetch() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url.includes('/api/storage/providers')) {
        return new Response(JSON.stringify({ data: mockProviders }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/storage/metrics')) {
        return new Response(
          JSON.stringify({
            data: {
              totalBytes: 10737418240,
              limitBytes: 53687091200,
              percentUsed: 20.0,
              totalCount: 2,
              linkedCount: 2,
              orphanCount: 0,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/storage/series')) {
        return new Response(JSON.stringify({ data: mockSeriesResponse }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/storage/resources')) {
        return new Response(
          JSON.stringify({
            data: { items: [], total: 0, page: 1, limit: 10, totalPages: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ data: { success: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  );
}

describe('Storage provider select controlled state (ticket 776)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    window.history.replaceState(null, '', '/admin/storage');
    setAccessToken('test-access-token');
    mockFetch();
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function controlledWarnings() {
    return consoleErrorSpy.mock.calls.filter((args: unknown[]) =>
      args.some(
        (a: unknown) =>
          typeof a === 'string' &&
          (a.includes('uncontrolled') ||
            a.includes('controlled') ||
            a.includes('changing a controlled'))
      )
    );
  }

  it('mounts the provider selector strictly controlled with the default provider immediately', async () => {
    renderWithProviders(<StorageView />);

    const trigger = await screen.findByTestId('provider-selector-dropdown');
    // Default provider resolves synchronously — no placeholder fallback frame.
    expect(trigger).toHaveTextContent('Backblaze B2 Main');

    await waitFor(() => {
      expect(screen.getByTestId('series-row-series-1')).toBeInTheDocument();
    });

    expect(controlledWarnings()).toHaveLength(0);
  });

  it('switching providers emits no uncontrolled/controlled warnings', async () => {
    const { user } = renderWithProviders(<StorageView />);

    const trigger = await screen.findByTestId('provider-selector-dropdown');
    await user.click(trigger);
    const secondOption = await screen.findByRole('option', {
      name: 'Cloudflare R2 Secondary',
    });
    await user.click(secondOption);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('providerId=prov-2'),
        expect.any(Object)
      );
    });

    expect(controlledWarnings()).toHaveLength(0);
  });

  it('clicking a series row navigates exactly once with provider search params and no warnings', async () => {
    const { user } = renderWithProviders(<StorageView />);

    const firstRow = await screen.findByTestId('series-row-series-1');
    await user.click(firstRow);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/admin/storage/$seriesId',
        params: { seriesId: 'series-1' },
        search: { providerId: 'prov-1' },
      })
    );

    expect(controlledWarnings()).toHaveLength(0);
  });
});
