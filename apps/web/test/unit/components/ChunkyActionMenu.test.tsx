import { describe, expect, it, vi } from 'vitest';
import { ChunkyActionMenu } from '@/components/ui/chunky-action-menu';
import { renderWithProviders, screen, waitFor, within } from '../../utils';

const items = [
  { label: 'Edit', onSelect: vi.fn() },
  { label: 'Sources', onSelect: vi.fn() },
  { label: 'Delete', onSelect: vi.fn(), danger: true },
];

function resetSpies() {
  items.forEach((i) => (i.onSelect as ReturnType<typeof vi.fn>).mockClear());
}

describe('ChunkyActionMenu primitive', () => {
  it('renders a 40x40 kebab trigger button', () => {
    renderWithProviders(<ChunkyActionMenu items={items} />);
    const trigger = screen.getByRole('button', { name: 'Open actions menu' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveClass('h-10', 'w-10');
    expect(trigger.querySelector('svg')).toBeInTheDocument();
  });

  it('opens a 180px chunky menu on trigger click', async () => {
    resetSpies();
    const { user } = renderWithProviders(<ChunkyActionMenu items={items} />);
    await user.click(screen.getByRole('button', { name: 'Open actions menu' }));
    const menu = await screen.findByRole('menu');
    expect(menu).toBeInTheDocument();
    expect(menu).toHaveClass('w-[180px]', 'border-b-4');
    expect(menu.className).toMatch('shadow-');
    expect(within(menu).getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('styles danger items in red', async () => {
    resetSpies();
    const { user } = renderWithProviders(<ChunkyActionMenu items={items} />);
    await user.click(screen.getByRole('button', { name: 'Open actions menu' }));
    const menu = await screen.findByRole('menu');
    const danger = within(menu).getByRole('menuitem', { name: 'Delete' });
    expect(danger.className).toMatch('var(--red)');
    expect(danger).toHaveClass('rounded-[12px]');
  });

  it('invokes the item callback and closes the menu on selection', async () => {
    resetSpies();
    const { user } = renderWithProviders(<ChunkyActionMenu items={items} />);
    await user.click(screen.getByRole('button', { name: 'Open actions menu' }));
    const menu = await screen.findByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Edit' }));
    expect(items[0].onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    resetSpies();
    const { user } = renderWithProviders(<ChunkyActionMenu items={items} />);
    const trigger = screen.getByRole('button', { name: 'Open actions menu' });
    await user.click(trigger);
    await screen.findByRole('menu');
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it('supports arrow-key navigation between menu items', async () => {
    resetSpies();
    const { user } = renderWithProviders(<ChunkyActionMenu items={items} />);
    await user.click(screen.getByRole('button', { name: 'Open actions menu' }));
    const menu = await screen.findByRole('menu');
    const menuItems = within(menu).getAllByRole('menuitem');
    expect(menuItems).toHaveLength(3);
    // First item auto-focused on open
    expect(menuItems[0]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(menuItems[1]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(menuItems[2]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(menuItems[1]).toHaveFocus();
  });
});
