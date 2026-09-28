import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setAccessToken } from '@/lib/api';
import { createTestQueryClient } from '../../utils';
import {
  deriveMinioEndpoint,
  generateMinioSecret,
  spinMinioUp,
  DEFAULT_MINIO_BUCKET,
} from '@/modules/storage/internal/api';
import { MinioSpinUpModal } from '@/modules/storage/internal/MinioSpinUpModal';
import { StorageView } from '@/modules/storage';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}));

const spinUpSuccessPayload = {
  data: {
    provider: {
      id: 'prov-minio',
      name: 'Local MinIO',
      providerType: 'minio',
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      bucket: 'private-movie-videos',
      accessKeyIdMasked: '••••admin',
      publicBaseUrl: null,
      forcePathStyle: true,
      storageLimitGb: 50,
      isDefault: true,
      isEnabled: true,
      linkedSourcesCount: 0,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    consoleUrl: 'http://localhost:9001',
    accessKeyId: 'minioadmin',
    secretAccessKey: 'supersecretkey1234567890ab',
  },
};

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return handler(url, init);
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('MinIO spin-up API helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('test-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('derives host endpoint with :9000 port', () => {
    // jsdom hostname is localhost
    expect(deriveMinioEndpoint()).toBe('http://localhost:9000');
    expect(deriveMinioEndpoint(9005)).toBe('http://localhost:9005');
  });

  it('generates a 24-character secure secret', () => {
    const secret = generateMinioSecret();
    expect(secret).toHaveLength(24);
    expect(secret).toMatch(/^[A-Za-z0-9]{24}$/);
    expect(generateMinioSecret()).not.toBe(generateMinioSecret());
  });

  it('posts spin-up payload and parses provider response', async () => {
    const fetchSpy = mockFetch((url) => {
      if (url.includes('/api/storage/minio/spin-up')) return json(spinUpSuccessPayload);
      return json({ data: null }, 500);
    });

    const res = await spinMinioUp({ bucket: 'private-movie-videos', isDefault: true });
    expect(res.provider.id).toBe('prov-minio');
    expect(res.consoleUrl).toBe('http://localhost:9001');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/storage/minio/spin-up'),
      expect.any(Object)
    );
  });

  it('throws with fallback message when spin-up fails', async () => {
    mockFetch(() => json({ error: { message: 'Docker unavailable' } }, 500));
    await expect(spinMinioUp({})).rejects.toThrow('Docker unavailable');
  });
});

describe('MinioSpinUpModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('test-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with sensible editable defaults', () => {
    mockFetch(() => json({ data: {} }));
    renderWithProviders(
      <MinioSpinUpModal open={true} onOpenChange={vi.fn()} providerCount={0} />
    );

    expect(screen.getByTestId('minio-spinup-modal')).toBeInTheDocument();
    expect(screen.getByTestId('minio-endpoint-input')).toHaveValue('http://localhost:9000');
    expect(screen.getByTestId('minio-bucket-input')).toHaveValue(DEFAULT_MINIO_BUCKET);
    expect(screen.getByTestId('minio-access-key-input')).toHaveValue('minioadmin');
    const secret = screen.getByTestId('minio-secret-key-input') as HTMLInputElement;
    expect(secret.value).toHaveLength(24);
    // Default-checked when zero providers exist
    expect(screen.getByTestId('minio-default-checkbox')).toBeChecked();
  });

  it('leaves default-provider unchecked when providers already exist', () => {
    mockFetch(() => json({ data: {} }));
    renderWithProviders(
      <MinioSpinUpModal open={true} onOpenChange={vi.fn()} providerCount={2} />
    );

    expect(screen.getByTestId('minio-default-checkbox')).not.toBeChecked();
  });

  it('toggles secret key visibility between password and text', async () => {
    mockFetch(() => json({ data: {} }));
    const { user } = renderWithProviders(
      <MinioSpinUpModal open={true} onOpenChange={vi.fn()} providerCount={0} />
    );

    const secret = screen.getByTestId('minio-secret-key-input') as HTMLInputElement;
    const toggle = screen.getByTestId('minio-toggle-secret-visibility-btn');
    expect(secret.type).toBe('password');

    await user.click(toggle);
    expect(secret.type).toBe('text');
    // Value preserved so the administrator can inspect or copy it
    expect(secret.value).toHaveLength(24);

    await user.click(toggle);
    expect(secret.type).toBe('password');
  });

  it('disables the form, shows progress stages, and closes with success toast on submit', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const onOpenChange = vi.fn();

    // Never-resolving spin-up keeps the pending state observable
    let resolveSpinUp!: (res: Response) => void;
    const gate = new Promise<Response>((resolve) => {
      resolveSpinUp = resolve;
    });
    mockFetch((url) => {
      if (url.includes('/api/storage/minio/spin-up')) return gate;
      return json({ data: {} });
    });

    const { user } = renderWithProviders(
      <MinioSpinUpModal open={true} onOpenChange={onOpenChange} providerCount={0} />,
      { queryClient }
    );

    await user.click(screen.getByTestId('minio-spinup-submit-btn'));

    // Pending: progress visible, submit disabled
    await waitFor(() => {
      expect(screen.getByTestId('minio-spinup-progress')).toBeInTheDocument();
    });
    expect(screen.getByTestId('minio-spinup-submit-btn')).toBeDisabled();
    expect(screen.getByTestId('minio-spinup-stage-0')).toBeInTheDocument();
    expect(screen.getByTestId('minio-spinup-stage-1')).toBeInTheDocument();
    expect(screen.getByTestId('minio-spinup-stage-2')).toBeInTheDocument();

    resolveSpinUp(json(spinUpSuccessPayload));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    // Cache invalidation for metrics, providers, resources (+ minio status)
    const keys = invalidateSpy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey?: unknown })?.queryKey));
    expect(keys.some((k) => k.includes('metrics'))).toBe(true);
    expect(keys.some((k) => k.includes('providers'))).toBe(true);
    expect(keys.some((k) => k.includes('resources'))).toBe(true);
  });

  it('displays an error banner when spin-up fails', async () => {
    mockFetch((url) => {
      if (url.includes('/api/storage/minio/spin-up')) {
        return json({ error: { message: 'Port 9000 already in use' } }, 500);
      }
      return json({ data: {} });
    });

    const { user } = renderWithProviders(
      <MinioSpinUpModal open={true} onOpenChange={vi.fn()} providerCount={0} />
    );

    await user.click(screen.getByTestId('minio-spinup-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('minio-spinup-error')).toHaveTextContent(/Port 9000 already in use/i);
    });
    // Modal stays open on failure
    expect(screen.getByTestId('minio-spinup-modal')).toBeInTheDocument();
  });
});

describe('StorageView MinIO spin-up entry points', () => {
  const emptyProviders = { data: [] as unknown[] };
  const emptyMetrics = {
    data: {
      totalBytes: 0,
      limitBytes: 53687091200,
      percentUsed: 0,
      totalCount: 0,
      linkedCount: 0,
      orphanCount: 0,
    },
  };
  const emptyResources = { data: { items: [], total: 0, page: 1, limit: 10, totalPages: 0 } };

  function baseHandler(statusPayload: unknown) {
    return (url: string) => {
      if (url.includes('/api/storage/minio/status')) return json({ data: statusPayload });
      if (url.includes('/api/storage/providers')) return json(emptyProviders);
      if (url.includes('/api/storage/metrics')) return json(emptyMetrics);
      if (url.includes('/api/storage/resources')) return json(emptyResources);
      return json({ data: {} });
    };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('test-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty-state hero with spin-up action when no providers exist', async () => {
    mockFetch(
      baseHandler({ isAvailable: true, isRunning: false, isConfigured: false })
    );
    renderWithProviders(<StorageView />);

    expect(await screen.findByTestId('minio-empty-state-hero')).toBeInTheDocument();
    expect(screen.getByTestId('minio-empty-state-spinup-btn')).toHaveTextContent(/Spin Up MinIO/i);
    // Header action offers spin-up when MinIO is not running
    expect(await screen.findByTestId('spin-up-minio-btn')).toBeInTheDocument();
  });

  it('opens the spin-up modal from the empty-state hero button', async () => {
    mockFetch(
      baseHandler({ isAvailable: true, isRunning: false, isConfigured: false })
    );
    const { user } = renderWithProviders(<StorageView />);

    await user.click(await screen.findByTestId('minio-empty-state-spinup-btn'));
    expect(await screen.findByTestId('minio-spinup-modal')).toBeInTheDocument();
  });

  it('shows MinIO Console link in header when MinIO is active', async () => {
    mockFetch(
      baseHandler({
        isAvailable: true,
        isRunning: true,
        isConfigured: true,
        consoleUrl: 'http://localhost:9001',
        endpoint: 'http://localhost:9000',
        bucket: 'private-movie-videos',
      })
    );
    renderWithProviders(<StorageView />);

    const link = await screen.findByTestId('minio-console-link-btn');
    expect(link).toHaveTextContent(/MinIO Console/i);
    expect(link.getAttribute('href')).toBe('http://localhost:9001');
    expect(screen.queryByTestId('spin-up-minio-btn')).not.toBeInTheDocument();
  });

  it('exposes spin-up action inside ManageProvidersDrawer', async () => {
    mockFetch(
      baseHandler({ isAvailable: true, isRunning: false, isConfigured: false })
    );
    const { user } = renderWithProviders(<StorageView />);

    await user.click(await screen.findByTestId('manage-providers-btn'));
    expect(await screen.findByTestId('manage-providers-drawer')).toBeInTheDocument();

    // Drawer spin-up button opens the modal and closes the drawer
    await user.click(screen.getByTestId('drawer-spin-up-minio-btn'));
    expect(await screen.findByTestId('minio-spinup-modal')).toBeInTheDocument();
  });
});
