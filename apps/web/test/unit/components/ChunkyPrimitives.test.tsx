import { describe, expect, it } from 'vitest';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import { ChunkyCardList, ChunkyCard } from '@/components/ui/chunky-card';
import { renderWithProviders, screen } from '../../utils';

describe('ChunkySkeleton primitive', () => {
  it('renders an animated pulse placeholder with chunky radius', () => {
    const { container } = renderWithProviders(
      <ChunkySkeleton className="h-20 w-full" />
    );
    const skeleton = container.querySelector('[data-testid="chunky-skeleton"]');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('animate-pulse', 'rounded-2xl', 'h-20', 'w-full');
  });

  it('accepts custom sizes', () => {
    const { container } = renderWithProviders(
      <ChunkySkeleton className="h-10 w-40" />
    );
    const skeleton = container.querySelector('[data-testid="chunky-skeleton"]');
    expect(skeleton).toHaveClass('h-10', 'w-40');
  });
});

describe('ChunkyCardList & ChunkyCard primitives', () => {
  it('renders a flex stack container with 12px gap', () => {
    renderWithProviders(
      <ChunkyCardList data-testid="card-list">
        <ChunkyCard>One</ChunkyCard>
      </ChunkyCardList>
    );
    const list = screen.getByTestId('card-list');
    expect(list).toHaveClass('flex', 'flex-col', 'gap-3');
  });

  it('renders cards with 3D border and 16px radius', () => {
    renderWithProviders(<ChunkyCard data-testid="card">Row</ChunkyCard>);
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('rounded-2xl', 'border-2', 'border-b-4');
  });

  it('applies hover lift for interactive cards', () => {
    renderWithProviders(
      <ChunkyCard interactive data-testid="card">
        Row
      </ChunkyCard>
    );
    expect(screen.getByTestId('card')).toHaveClass('hover:-translate-y-[2px]');
  });

  it('applies green-tint selected styles', () => {
    renderWithProviders(
      <ChunkyCard selected data-testid="card">
        Row
      </ChunkyCard>
    );
    const card = screen.getByTestId('card');
    expect(card).toHaveAttribute('data-selected', 'true');
    expect(card.className).toMatch('border-[var(--green)]');
    expect(card.className).toMatch('bg-[var(--green-soft)]');
  });
});
