import { describe, expect, it, vi } from 'vitest';
import {
  ChunkyTooltip,
  ChunkyTooltipContent,
  ChunkyTooltipProvider,
  ChunkyTooltipRoot,
  ChunkyTooltipTrigger,
} from '@/components/ui/chunky-tooltip';
import { renderWithProviders, screen, waitFor } from '../../utils';

describe('ChunkyTooltip primitive', () => {
  it('shows content on mouse hover', async () => {
    const { user } = renderWithProviders(
      <ChunkyTooltip content="Save to your list">
        <button type="button">Save</button>
      </ChunkyTooltip>
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.hover(screen.getByRole('button', { name: 'Save' }));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Save to your list');
  });

  it('shows content on keyboard focus', async () => {
    const { user } = renderWithProviders(
      <ChunkyTooltip content="Play trailer">
        <button type="button">Play</button>
      </ChunkyTooltip>
    );
    const trigger = screen.getByRole('button', { name: 'Play' });
    await user.tab();
    expect(trigger).toHaveFocus();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Play trailer');
    expect(trigger).toHaveAttribute('aria-describedby');
  });

  it('styles content with chunky tokens', async () => {
    const { user } = renderWithProviders(
      <ChunkyTooltip content="Chunky style">
        <button type="button">Target</button>
      </ChunkyTooltip>
    );
    await user.hover(screen.getByRole('button', { name: 'Target' }));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveClass(
      'bg-[var(--surface-raised)]',
      'border-2',
      'border-[var(--border)]',
      'text-[var(--ink)]',
      'font-bold',
      'text-xs',
      'rounded-xl',
      'shadow-lg',
      'px-2.5',
      'py-1.5'
    );
  });

  it('dismisses on Escape', async () => {
    const { user } = renderWithProviders(
      <ChunkyTooltip content="Dismiss me">
        <button type="button">Trigger</button>
      </ChunkyTooltip>
    );
    await user.hover(screen.getByRole('button', { name: 'Trigger' }));
    await screen.findByRole('tooltip');
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('supports composable parts directly', async () => {
    const { user } = renderWithProviders(
      <ChunkyTooltipProvider delayDuration={0}>
        <ChunkyTooltipRoot>
          <ChunkyTooltipTrigger asChild>
            <button type="button">Composed</button>
          </ChunkyTooltipTrigger>
          <ChunkyTooltipContent>Composed content</ChunkyTooltipContent>
        </ChunkyTooltipRoot>
      </ChunkyTooltipProvider>
    );
    await user.hover(screen.getByRole('button', { name: 'Composed' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Composed content'
    );
  });

  it('renders without console errors', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const { user, unmount } = renderWithProviders(
        <ChunkyTooltip content="Clean render">
          <button type="button">Clean</button>
        </ChunkyTooltip>
      );
      await user.hover(screen.getByRole('button', { name: 'Clean' }));
      await screen.findByRole('tooltip');
      await user.unhover(screen.getByRole('button', { name: 'Clean' }));
      unmount();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
