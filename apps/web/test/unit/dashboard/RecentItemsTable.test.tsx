import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it } from 'vitest';
import { RecentItemsTable } from '@/modules/dashboard/internal/RecentItemsTable';

describe('RecentItemsTable component', () => {
  it('renders table header, item count, and column headers', () => {
    renderWithProviders(<RecentItemsTable />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Recent items' })
    ).toBeInTheDocument();
    expect(screen.getByText('24 total')).toBeInTheDocument();

    expect(screen.getByText('Name ↕')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Assignee')).toBeInTheDocument();
    expect(screen.getByText('Date ↕')).toBeInTheDocument();
  });

  it('renders list of items with proper status badge styles', () => {
    renderWithProviders(<RecentItemsTable />);

    expect(screen.getByText('Item one')).toBeInTheDocument();
    expect(screen.getByText('Jane Cooper')).toBeInTheDocument();
    expect(screen.getByText('2h ago')).toBeInTheDocument();

    const activeBadge = screen.getAllByText('Active')[0];
    expect(activeBadge).toHaveClass('bg-green-100', 'text-green-700');

    expect(screen.getByText('Item two')).toBeInTheDocument();
    expect(screen.getByText('Wade Warren')).toBeInTheDocument();
    expect(screen.getByText('5h ago')).toBeInTheDocument();

    const pendingBadge = screen.getByText('Pending');
    expect(pendingBadge).toHaveClass('bg-amber-100', 'text-amber-700');

    expect(screen.getByText('Item four')).toBeInTheDocument();
    expect(screen.getByText('Cody Fisher')).toBeInTheDocument();
    expect(screen.getByText('2d ago')).toBeInTheDocument();

    const inactiveBadge = screen.getByText('Inactive');
    expect(inactiveBadge).toHaveClass('bg-red-100', 'text-red-700');
  });

  it('toggles dropdown menu on action button click and closes other dropdowns', async () => {
    const { user } = renderWithProviders(<RecentItemsTable />);

    // Initially no dropdown options ("Edit") should be visible
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();

    const actionButtons = screen.getAllByRole('button', { name: 'Actions' });
    expect(actionButtons.length).toBeGreaterThanOrEqual(4);

    // Click first row's action button
    await user.click(actionButtons[0]);
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();

    // Click second row's action button -> should close first row's and open second row's
    await user.click(actionButtons[1]);
    expect(screen.getAllByText('Edit').length).toBe(1);

    // Click second row's action button again -> should toggle off / close
    await user.click(actionButtons[1]);
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('renders pagination controls', () => {
    renderWithProviders(<RecentItemsTable />);

    expect(screen.getByText('Page 1 of 6')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Previous' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });
});
