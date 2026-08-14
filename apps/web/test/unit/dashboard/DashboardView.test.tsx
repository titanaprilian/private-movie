import { renderWithProviders, screen, userEvent } from '../../utils';
import { describe, expect, it } from 'vitest';
import { DashboardView } from '@/modules/dashboard';
import { Toaster } from '@/components/ui/sonner';

describe('DashboardView component', () => {
  it('renders page heading, description, and action button', () => {
    renderWithProviders(<DashboardView />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Dashboard' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Overview of your data for this period.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '+ Add new' })
    ).toBeInTheDocument();
  });

  it('triggers a success toast when + Add new button is clicked', async () => {
    renderWithProviders(
      <>
        <DashboardView />
        <Toaster />
      </>
    );

    const user = userEvent.setup();
    const addButton = screen.getByRole('button', { name: '+ Add new' });
    await user.click(addButton);

    expect(await screen.findByText('item.create')).toBeInTheDocument();
    expect(screen.getByText('new item created successfully')).toBeInTheDocument();
  });

  it('renders metrics grid with correct placeholder values and trends', () => {
    renderWithProviders(<DashboardView />);

    expect(screen.getByText('Metric one')).toBeInTheDocument();
    expect(screen.getByText('1,204')).toBeInTheDocument();
    expect(screen.getByText('+12% from last period')).toBeInTheDocument();

    expect(screen.getByText('Metric two')).toBeInTheDocument();
    expect(screen.getByText('386')).toBeInTheDocument();
    expect(screen.getByText('+4% from last period')).toBeInTheDocument();

    expect(screen.getByText('Metric three')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('-2% from last period')).toBeInTheDocument();

    expect(screen.getByText('Metric four')).toBeInTheDocument();
    expect(screen.getByText('$18.2k')).toBeInTheDocument();
    expect(screen.getByText('+9% from last period')).toBeInTheDocument();
  });

  it('renders quick actions panel with action buttons', () => {
    renderWithProviders(<DashboardView />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Quick actions' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create new item' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Invite a member' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'View reports' })
    ).toBeInTheDocument();
  });

  it('renders recent activity feed', () => {
    renderWithProviders(<DashboardView />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Recent activity' })
    ).toBeInTheDocument();
    expect(screen.getByText('updated Item one')).toBeInTheDocument();

    expect(screen.getByText('created Item two')).toBeInTheDocument();

    expect(screen.getByText('commented on Item three')).toBeInTheDocument();

    expect(screen.getByText('closed Item four')).toBeInTheDocument();
  });

  it('renders recent items data table', () => {
    renderWithProviders(<DashboardView />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Recent items' })
    ).toBeInTheDocument();
    expect(screen.getByText('24 total')).toBeInTheDocument();
  });
});
