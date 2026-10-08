import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../utils';
import { StorageView } from '@/modules/storage/internal/StorageView';

function mockFailingStorageFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    return new Response(
      JSON.stringify({
        error: {
          code: 'S3_NOT_CONFIGURED',
          message: 'S3 storage service is not configured',
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  });
}

describe('StorageView shared error state', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the shared error primitive with a working retry action', async () => {
    const fetchSpy = mockFailingStorageFetch();

    const { user } = renderWithProviders(<StorageView />);

    await waitFor(() => {
      expect(screen.getByTestId('storage-error-alert')).toBeInTheDocument();
    });

    // Shared primitive content inside the module's alert container.
    expect(screen.getByText('Storage Warning')).toBeInTheDocument();
    expect(
      screen.getByText(/S3 storage service is not configured/i)
    ).toBeInTheDocument();

    const callsBeforeRetry = fetchSpy.mock.calls.length;
    expect(callsBeforeRetry).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
    });
  });
});
