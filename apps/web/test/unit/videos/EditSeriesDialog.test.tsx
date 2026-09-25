import { renderWithProviders, screen, waitFor, fireEvent } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EditSeriesDialog } from '@/modules/videos/internal/EditSeriesDialog';
import type { SeriesItem } from '@/modules/videos/internal/api';
import { setAccessToken } from '@/lib/api';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockSeries: SeriesItem = {
  id: 'series-1',
  sourceUrl: 'https://otakudesu.cloud/anime/series-1',
  source: 'otakudesu',
  title: 'Test Series',
  description: 'A test series.',
  posterUrl: null,
  isFeatured: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('EditSeriesDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken('test-token');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      const method = init?.method?.toUpperCase() ?? 'GET';

      if (url.includes('/genres')) {
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/series/series-1') && method === 'PATCH') {
        const body = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({ data: { ...mockSeries, ...body } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
        status: 404,
      });
    });
  });

  it('opens, syncs form state without render looping, and saves via PATCH', async () => {
    // NOTE: regression test — the sync effect used to depend on the
    // `seriesList` array identity (fresh `[]` every render) while calling
    // setState with fresh arrays, an infinite effect→render loop that hung
    // any test opening this dialog forever. If the loop regresses, this test
    // hits the 10s testTimeout instead of passing.
    let patchedBody: Record<string, unknown> | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      const method = init?.method?.toUpperCase() ?? 'GET';

      if (url.includes('/genres')) {
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/series/series-1') && method === 'PATCH') {
        patchedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({ data: { ...mockSeries, ...patchedBody } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
        status: 404,
      });
    });

    const onOpenChange = vi.fn();
    const { user, queryClient } = renderWithProviders(
      <EditSeriesDialog
        open={true}
        onOpenChange={onOpenChange}
        series={mockSeries}
      />
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    expect(
      await screen.findByRole('heading', { name: 'Edit Series' })
    ).toBeInTheDocument();

    const featuredCheckbox = screen.getByLabelText(
      'Featured Series'
    ) as HTMLInputElement;
    expect(featuredCheckbox.checked).toBe(false);

    await user.click(featuredCheckbox);
    expect(featuredCheckbox.checked).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(patchedBody).toEqual(
        expect.objectContaining({ isFeatured: true })
      );
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series'] });
      expect(toast.success).toHaveBeenCalledWith(
        'series.update',
        expect.objectContaining({
          description: expect.stringContaining('Test Series'),
        })
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('re-renders with an inline seriesList without re-syncing state in a loop', async () => {    const { rerender } = renderWithProviders(
      <EditSeriesDialog
        open={true}
        onOpenChange={vi.fn()}
        series={mockSeries}
        seriesList={[{ ...mockSeries }]}
      />
    );

    expect(
      await screen.findByRole('heading', { name: 'Edit Series' })
    ).toBeInTheDocument();

    // Force several re-renders with fresh inline array identities; the sync
    // effect must bail out instead of looping.
    for (let i = 0; i < 5; i += 1) {
      rerender(
        <EditSeriesDialog
          open={true}
          onOpenChange={vi.fn()}
          series={mockSeries}
          seriesList={[{ ...mockSeries }]}
        />
      );
    }

    expect(
      screen.getByRole('heading', { name: 'Edit Series' })
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Featured Series') as HTMLInputElement
    ).toBeInTheDocument();
  });
});

describe('EditSeriesDialog sizing, flags, and logo URL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken('test-token');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;

      if (url.includes('/genres')) {
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
        status: 404,
      });
    });
  });

  function mockPatchCapture(
    onBody: (body: Record<string, unknown>) => void
  ) {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      const method = init?.method?.toUpperCase() ?? 'GET';

      if (url.includes('/genres')) {
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/series/series-1') && method === 'PATCH') {
        const body = JSON.parse(init?.body as string);
        onBody(body);
        return new Response(
          JSON.stringify({ data: { ...mockSeries, ...body } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
        status: 404,
      });
    });
  }

  it('constrains dialog height with a scrollable body', async () => {
    const { container } = renderWithProviders(
      <EditSeriesDialog
        open={true}
        onOpenChange={vi.fn()}
        series={mockSeries}
      />
    );
    void container;

    expect(
      await screen.findByRole('heading', { name: 'Edit Series' })
    ).toBeInTheDocument();

    // Radix renders dialog content in a portal attached to document.body.
    const content = await screen.findByRole('dialog');
    expect(content.className).toContain('max-h-[90vh]');

    const scrollBody = content.parentElement?.querySelector('.overflow-y-auto') ?? document.querySelector('.overflow-y-auto');
    expect(scrollBody).not.toBeNull();
    expect(scrollBody?.className).toContain('flex-1');
  });

  it('renders featured and highlight checkboxes on a single wrapped row and keeps them independent', async () => {
    const { user } = renderWithProviders(
      <EditSeriesDialog
        open={true}
        onOpenChange={vi.fn()}
        series={mockSeries}
      />
    );

    const featured = (await screen.findByLabelText(
      'Featured Series'
    )) as HTMLInputElement;
    const highlighted = screen.getByLabelText(
      'Highlight in Ongoing Feed'
    ) as HTMLInputElement;

    expect(featured.parentElement?.parentElement?.className).toContain(
      'flex'
    );
    expect(featured.parentElement?.parentElement?.className).toContain(
      'flex-wrap'
    );
    expect(highlighted.parentElement?.parentElement).toBe(
      featured.parentElement?.parentElement
    );

    expect(featured.checked).toBe(false);
    expect(highlighted.checked).toBe(false);

    await user.click(featured);
    expect(featured.checked).toBe(true);
    expect(highlighted.checked).toBe(false);

    await user.click(highlighted);
    expect(featured.checked).toBe(true);
    expect(highlighted.checked).toBe(true);
  });

  it('prefills logo URL, shows live preview, and submits the new URL', async () => {
    let patchedBody: Record<string, unknown> | null = null;
    mockPatchCapture((body) => {
      patchedBody = body;
    });

    const seriesWithLogo: SeriesItem = {
      ...mockSeries,
      logoUrl: 'https://example.com/existing-logo.png',
    } as SeriesItem;

    const { user } = renderWithProviders(
      <EditSeriesDialog
        open={true}
        onOpenChange={vi.fn()}
        series={seriesWithLogo}
      />
    );

    const logoInput = (await screen.findByLabelText(
      'Logo URL'
    )) as HTMLInputElement;
    expect(logoInput.value).toBe('https://example.com/existing-logo.png');
    expect(screen.getByAltText('Logo preview')).toBeInTheDocument();

    await user.clear(logoInput);
    await user.type(logoInput, 'https://example.com/custom-logo.png');

    const preview = (await screen.findByAltText(
      'Logo preview'
    )) as HTMLImageElement;
    expect(preview.getAttribute('src')).toBe(
      'https://example.com/custom-logo.png'
    );

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(patchedBody).toEqual(
        expect.objectContaining({
          logoUrl: 'https://example.com/custom-logo.png',
        })
      );
    });
  });

  it('shows a fallback indicator when the logo preview fails to load', async () => {
    renderWithProviders(
      <EditSeriesDialog
        open={true}
        onOpenChange={vi.fn()}
        series={{
          ...mockSeries,
          logoUrl: 'https://example.com/broken-logo.png',
        } as SeriesItem}
      />
    );

    const preview = (await screen.findByAltText(
      'Logo preview'
    )) as HTMLImageElement;
    fireEvent.error(preview);

    expect(
      await screen.findByText('Failed to load logo preview')
    ).toBeInTheDocument();
  });

  it('sends logoUrl null when the field is cleared', async () => {
    let patchedBody: Record<string, unknown> | null = null;
    mockPatchCapture((body) => {
      patchedBody = body;
    });

    const { user } = renderWithProviders(
      <EditSeriesDialog
        open={true}
        onOpenChange={vi.fn()}
        series={{
          ...mockSeries,
          logoUrl: 'https://example.com/existing-logo.png',
        } as SeriesItem}
      />
    );

    const logoInput = (await screen.findByLabelText(
      'Logo URL'
    )) as HTMLInputElement;
    expect(logoInput.value).toBe('https://example.com/existing-logo.png');

    await user.clear(logoInput);
    expect(logoInput.value).toBe('');
    expect(screen.queryByAltText('Logo preview')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(patchedBody).toEqual(expect.objectContaining({ logoUrl: null }));
    });
  });
});
