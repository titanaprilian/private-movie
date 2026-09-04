import { renderWithProviders, screen, waitFor } from '../../utils';
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

  it('re-renders with an inline seriesList without re-syncing state in a loop', async () => {
    const { rerender } = renderWithProviders(
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
