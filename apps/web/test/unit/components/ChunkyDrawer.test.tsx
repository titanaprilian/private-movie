import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import {
  ChunkyDrawer,
  ChunkyDrawerTrigger,
  ChunkyDrawerContent,
  ChunkyDrawerHeader,
  ChunkyDrawerTitle,
  ChunkyDrawerDescription,
  ChunkyDrawerBody,
  ChunkyDrawerFooter,
} from '@/components/ui/chunky-drawer';
import { ChunkyInput } from '@/components/ui/chunky-input';
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import { renderWithProviders } from '../../utils';

function DrawerHarness({
  defaultOpen = false,
  onOpenChange,
}: {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <ChunkyDrawer defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <ChunkyDrawerTrigger>Open drawer</ChunkyDrawerTrigger>
      <ChunkyDrawerContent>
        <ChunkyDrawerHeader>
          <ChunkyDrawerTitle>Edit season</ChunkyDrawerTitle>
          <ChunkyDrawerDescription>
            Update the season details.
          </ChunkyDrawerDescription>
        </ChunkyDrawerHeader>
        <ChunkyDrawerBody>
          <ChunkyInput aria-label="Season name" defaultValue="Season 1" />
        </ChunkyDrawerBody>
        <ChunkyDrawerFooter>
          <button type="button">Save</button>
        </ChunkyDrawerFooter>
      </ChunkyDrawerContent>
    </ChunkyDrawer>
  );
}

describe('ChunkyDrawer primitive', () => {
  it('opens via trigger and renders header, body, and footer regions', async () => {
    const { user } = renderWithProviders(<DrawerHarness />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));

    expect(
      await screen.findByRole('dialog', { name: /edit season/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId('chunky-drawer-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('chunky-drawer-header')).toBeInTheDocument();
    expect(screen.getByTestId('chunky-drawer-body')).toBeInTheDocument();
    expect(screen.getByTestId('chunky-drawer-footer')).toBeInTheDocument();
    expect(
      screen.getByText('Update the season details.')
    ).toBeInTheDocument();
  });

  it('slides out from the right side with a chunky sheet', async () => {
    const { user } = renderWithProviders(<DrawerHarness />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));

    const content = await screen.findByTestId('chunky-drawer-content');
    expect(content).toHaveClass('right-0', 'max-w-md', 'rounded-l-[20px]');
    expect(content.className).toMatch('slide-in-from-right');
  });

  it('closes on Escape and reports the change', async () => {
    const onOpenChange = vi.fn();
    const { user } = renderWithProviders(
      <DrawerHarness defaultOpen onOpenChange={onOpenChange} />
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(onOpenChange).toHaveBeenCalledWith(false)
    );
  });

  it('closes when clicking outside (overlay pointer down)', async () => {
    const onOpenChange = vi.fn();
    const { user } = renderWithProviders(
      <DrawerHarness defaultOpen onOpenChange={onOpenChange} />
    );

    const overlay = await screen.findByTestId('chunky-drawer-overlay');
    await user.click(overlay);

    await waitFor(() =>
      expect(onOpenChange).toHaveBeenCalledWith(false)
    );
  });

  it('moves focus into the dialog and closes via the header close button', async () => {
    const { user } = renderWithProviders(<DrawerHarness />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('emits no console errors during the open/close lifecycle', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { user } = renderWithProviders(<DrawerHarness />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('Chunky form controls', () => {
  it('renders a chunky text input with 3D border geometry and bold 14px type', async () => {
    const { user } = renderWithProviders(
      <ChunkyInput aria-label="Title" placeholder="Enter title" />
    );
    const input = screen.getByRole('textbox', { name: 'Title' });
    expect(input).toHaveClass(
      'rounded-2xl',
      'border-2',
      'border-b-4',
      'text-sm',
      'font-bold'
    );
    await user.type(input, 'Dune');
    expect(input).toHaveValue('Dune');
  });

  it('renders a chunky Radix select with placeholder and keyboard-selectable options', async () => {
    const { user } = renderWithProviders(
      <ChunkySelect>
        <ChunkySelectTrigger aria-label="Quality">
          <ChunkySelectValue placeholder="Select quality" />
        </ChunkySelectTrigger>
        <ChunkySelectContent>
          <ChunkySelectItem value="hd">HD</ChunkySelectItem>
          <ChunkySelectItem value="uhd">UHD</ChunkySelectItem>
        </ChunkySelectContent>
      </ChunkySelect>
    );

    const trigger = screen.getByRole('combobox', { name: 'Quality' });
    expect(trigger).toHaveClass('rounded-2xl', 'border-2', 'border-b-4');
    expect(screen.getByText('Select quality')).toBeInTheDocument();

    await user.click(trigger);
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'UHD' }));
    expect(screen.getByText('UHD')).toBeInTheDocument();
  });
});
