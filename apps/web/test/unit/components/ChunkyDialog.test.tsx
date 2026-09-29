import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import {
  ChunkyDialog,
  ChunkyDialogTrigger,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import { ChunkyTextarea } from '@/components/ui/chunky-textarea';
import { renderWithProviders } from '../../utils';

function DialogHarness({
  defaultOpen = false,
  onOpenChange,
}: {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <ChunkyDialog defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <ChunkyDialogTrigger>Open dialog</ChunkyDialogTrigger>
      <ChunkyDialogContent>
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>Delete series</ChunkyDialogTitle>
          <ChunkyDialogDescription>
            This action cannot be undone.
          </ChunkyDialogDescription>
        </ChunkyDialogHeader>
        <ChunkyDialogBody>
          <ChunkyTextarea aria-label="Reason" placeholder="Tell us why" />
        </ChunkyDialogBody>
        <ChunkyDialogFooter>
          <button type="button">Confirm</button>
        </ChunkyDialogFooter>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}

describe('ChunkyDialog primitive', () => {
  it('opens via trigger and renders an accessible centered modal with header, body, and footer', async () => {
    const { user } = renderWithProviders(<DialogHarness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));

    expect(
      await screen.findByRole('dialog', { name: /delete series/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId('chunky-dialog-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('chunky-dialog-header')).toBeInTheDocument();
    expect(screen.getByTestId('chunky-dialog-body')).toBeInTheDocument();
    expect(screen.getByTestId('chunky-dialog-footer')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('renders a centered 3D card sheet with zoom/fade animations', async () => {
    const { user } = renderWithProviders(<DialogHarness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));

    const content = await screen.findByTestId('chunky-dialog-content');
    expect(content).toHaveClass(
      'rounded-[24px]',
      'border-2',
      'border-b-4',
      'translate-x-[-50%]',
      'translate-y-[-50%]'
    );
    expect(content.className).toMatch('zoom-in-95');
    expect(content.className).toMatch('fade-in-0');

    const overlay = screen.getByTestId('chunky-dialog-overlay');
    expect(overlay.className).toMatch('backdrop-blur');
    expect(overlay.className).toMatch('bg-black/50');
  });

  it('closes on Escape and reports the change', async () => {
    const onOpenChange = vi.fn();
    const { user } = renderWithProviders(
      <DialogHarness defaultOpen onOpenChange={onOpenChange} />
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('closes when clicking outside (overlay pointer down)', async () => {
    const onOpenChange = vi.fn();
    const { user } = renderWithProviders(
      <DialogHarness defaultOpen onOpenChange={onOpenChange} />
    );

    const overlay = await screen.findByTestId('chunky-dialog-overlay');
    await user.click(overlay);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('moves focus into the dialog and closes via the header close button', async () => {
    const { user } = renderWithProviders(<DialogHarness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('emits no console errors during the open/close lifecycle', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { user } = renderWithProviders(<DialogHarness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('ChunkyTextarea primitive', () => {
  it('renders with chunky border geometry, bold 14px type, and focus styling', async () => {
    const { user } = renderWithProviders(
      <ChunkyTextarea aria-label="Reason" placeholder="Tell us why" />
    );
    const field = screen.getByRole('textbox', { name: 'Reason' });
    expect(field).toHaveClass(
      'rounded-2xl',
      'border-2',
      'border-b-4',
      'text-sm',
      'font-bold'
    );
    expect(field.className).toMatch('focus-visible:ring-2');
    await user.type(field, 'Duplicate entry');
    expect(field).toHaveValue('Duplicate entry');
  });
});
