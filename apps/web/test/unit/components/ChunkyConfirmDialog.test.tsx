import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { ChunkyConfirmDialog } from '@/components/ui/chunky-confirm-dialog';
import { renderWithProviders } from '../../utils';

describe('ChunkyConfirmDialog primitive', () => {
  it('renders an accessible modal dialog with smooth open/close animations', async () => {
    const { user } = renderWithProviders(
      <ChunkyConfirmDialog
        defaultOpen={false}
        title="Delete series"
        description="This action cannot be undone."
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Re-render open via controlled harness
    const { user: user2 } = renderWithProviders(
      <ChunkyConfirmDialog
        defaultOpen
        title="Delete series"
        description="This action cannot be undone."
      />
    );
    void user;
    void user2;
    const dialog = await screen.findByRole('dialog', {
      name: /delete series/i,
    });
    expect(dialog).toBeInTheDocument();
    const content = screen.getByTestId('chunky-confirm-dialog');
    expect(content.className).toMatch('zoom-in-95');
    expect(content.className).toMatch('fade-in-0');
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('supports configurable labels, ReactNode description, and confirm variants', async () => {
    renderWithProviders(
      <ChunkyConfirmDialog
        defaultOpen
        title="Remove file"
        description={<span>Custom <strong>rich</strong> body</span>}
        confirmLabel="Remove"
        cancelLabel="Keep"
        confirmVariant="primary"
      />
    );
    expect(await screen.findByRole('dialog', { name: /remove file/i })).toBeInTheDocument();
    expect(screen.getByText('Remove')).toBeInTheDocument();
    expect(screen.getByText('Keep')).toBeInTheDocument();
    expect(screen.getByText('rich')).toBeInTheDocument();
    // non-danger variant hides the warning badge
    expect(screen.queryByTestId('chunky-confirm-badge')).not.toBeInTheDocument();
  });

  it('uses Delete / Cancel defaults and danger variant by default', async () => {
    renderWithProviders(
      <ChunkyConfirmDialog defaultOpen title="Delete series" description="Sure?" />
    );
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByTestId('chunky-confirm-badge')).toBeInTheDocument();
  });

  it('renders a danger accent badge with an alert icon', async () => {
    renderWithProviders(
      <ChunkyConfirmDialog
        defaultOpen
        title="Delete series"
        description="Sure?"
        confirmVariant="danger"
      />
    );
    await screen.findByRole('dialog');
    const badge = screen.getByTestId('chunky-confirm-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.querySelector('svg')).not.toBeNull();
  });

  it('triggers confirm and disables interactions with a loading spinner while pending', async () => {
    const onConfirm = vi.fn();
    const { user, rerender } = renderWithProviders(
      <ChunkyConfirmDialog
        defaultOpen
        title="Delete series"
        description="Sure?"
        onConfirm={onConfirm}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    rerender(
      <ChunkyConfirmDialog
        defaultOpen
        title="Delete series"
        description="Sure?"
        onConfirm={onConfirm}
        isPending
      />
    );
    expect(screen.getByTestId('chunky-confirm-spinner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    // still 1 — pending blocks re-trigger
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('supports Escape dismissal and clicking outside to cancel', async () => {
    const onOpenChange = vi.fn();
    const { user } = renderWithProviders(
      <ChunkyConfirmDialog
        defaultOpen
        onOpenChange={onOpenChange}
        title="Delete series"
        description="Sure?"
      />
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    onOpenChange.mockClear();
    renderWithProviders(
      <ChunkyConfirmDialog
        defaultOpen
        onOpenChange={onOpenChange}
        title="Delete series"
        description="Sure?"
      />
    );
    const overlay = await screen.findByTestId('chunky-dialog-overlay');
    await user.click(overlay);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('traps focus and closes via the Cancel action', async () => {
    const onOpenChange = vi.fn();
    const { user } = renderWithProviders(
      <ChunkyConfirmDialog
        defaultOpen
        onOpenChange={onOpenChange}
        title="Delete series"
        description="Sure?"
      />
    );
    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('emits no console errors during the open/close lifecycle', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { user } = renderWithProviders(
      <ChunkyConfirmDialog
        defaultOpen
        title="Delete series"
        description="Sure?"
      />
    );
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
