import {
  ChunkyTabs,
  ChunkyTabsContent,
  ChunkyTabsList,
  ChunkyTabsTrigger,
} from '@/components/ui/chunky-tabs';
import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it } from 'vitest';

function TestTabs() {
  return (
    <ChunkyTabs defaultValue="all">
      <ChunkyTabsList>
        <ChunkyTabsTrigger value="all">All</ChunkyTabsTrigger>
        <ChunkyTabsTrigger value="featured">Featured</ChunkyTabsTrigger>
        <ChunkyTabsTrigger value="ongoing">Ongoing</ChunkyTabsTrigger>
      </ChunkyTabsList>
      <ChunkyTabsContent value="all">All content</ChunkyTabsContent>
      <ChunkyTabsContent value="featured">Featured content</ChunkyTabsContent>
      <ChunkyTabsContent value="ongoing">Ongoing content</ChunkyTabsContent>
    </ChunkyTabs>
  );
}

describe('ChunkyTabs component', () => {
  it('exposes tablist and tab semantics', () => {
    renderWithProviders(<TestTabs />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('marks the default tab as selected', () => {
    renderWithProviders(<TestTabs />);
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: 'Featured' })).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });

  it('shows active green-tint highlight on the selected tab', () => {
    renderWithProviders(<TestTabs />);
    const active = screen.getByRole('tab', { name: 'All' });
    expect(active.className).toMatch('data-[state=active]:bg-[var(--green-soft)]');
    expect(active.className).toMatch('data-[state=active]:border-[var(--green)]');
  });

  it('applies tactile press physics to triggers', () => {
    renderWithProviders(<TestTabs />);
    const tab = screen.getByRole('tab', { name: 'All' });
    expect(tab.className).toMatch('border-b-4');
    expect(tab.className).toMatch('active:translate-y-[2px]');
    expect(tab.className).toMatch('active:border-b-2');
  });

  it('exposes visible keyboard focus rings on triggers', () => {
    renderWithProviders(<TestTabs />);
    const tab = screen.getByRole('tab', { name: 'All' });
    expect(tab.className).toMatch('focus-visible:ring-2');
    expect(tab.className).toMatch('focus-visible:ring-[var(--blue)]');
  });

  it('switches selection on click', async () => {
    const { user } = renderWithProviders(<TestTabs />);
    await user.click(screen.getByRole('tab', { name: 'Featured' }));
    expect(screen.getByRole('tab', { name: 'Featured' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText('Featured content')).toBeInTheDocument();
  });

  it('supports arrow-key navigation between tabs', async () => {
    const { user } = renderWithProviders(<TestTabs />);
    const all = screen.getByRole('tab', { name: 'All' });
    all.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Featured' })).toHaveFocus();
  });
});
