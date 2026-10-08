import { ErrorState } from '@/components/ui/error-state';
import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi } from 'vitest';

describe('ErrorState component', () => {
  it('renders title, description, and a retry button when onRetry is provided', async () => {
    const onRetry = vi.fn();
    const { user } = renderWithProviders(
      <ErrorState
        title="Unable to Load Home Feed"
        description="Check your connection and try again."
        onRetry={onRetry}
        retryLabel="Retry Connection"
      />
    );

    expect(screen.getByTestId('error-state')).toBeInTheDocument();
    expect(screen.getByText('Unable to Load Home Feed')).toBeInTheDocument();
    expect(
      screen.getByText('Check your connection and try again.')
    ).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', {
      name: /retry connection/i,
    });
    await user.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the retry button when no onRetry callback is provided', () => {
    renderWithProviders(
      <ErrorState title="Storage Warning" description="S3 is unavailable." />
    );

    expect(screen.getByText('Storage Warning')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies danger design tokens by default and warning tokens on request', () => {
    const { rerender } = renderWithProviders(
      <ErrorState title="Danger" description="boom" onRetry={() => {}} />
    );
    expect(screen.getByRole('button', { name: /retry/i }).className).toMatch(
      'bg-[var(--red)]'
    );

    rerender(
      <ErrorState
        title="Warning"
        description="heads up"
        tone="warning"
        onRetry={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /retry/i }).className).toMatch(
      'bg-[var(--gold)]'
    );
  });

  it('supports a custom test id', () => {
    renderWithProviders(
      <ErrorState title="Custom" testId="custom-error" />
    );
    expect(screen.getByTestId('custom-error')).toBeInTheDocument();
  });
});
