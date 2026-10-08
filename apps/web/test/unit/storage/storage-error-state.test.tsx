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

  it('renders only a centered error state, suppressing empty hero, metrics and table', async () => {
    mockFailingStorageFetch();

    renderWithProviders(<StorageView />);

    const alert = await screen.findByTestId('storage-error-alert');
    expect(alert).toBeInTheDocument();
    expect(alert.className).toMatch(/justify-center/);

    // Shared primitive content inside the module's alert container.
    expect(screen.getByText('Storage Warning')).toBeInTheDocument();
    expect(
      screen.getByText(/S3 storage service is not configured/i)
    ).toBeInTheDocument();

    // Suppressed while in an active error state.
    expect(
      screen.queryByText(/No storage connected yet/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('minio-empty-state-hero')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('metric-total-files')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('storage-search-input')
    ).not.toBeInTheDocument();
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

    // Retry refetches providers, metrics, and resources (3+ refetch calls).
    await waitFor(() => {
      expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(
        callsBeforeRetry + 3
      );
    });
  });
});
