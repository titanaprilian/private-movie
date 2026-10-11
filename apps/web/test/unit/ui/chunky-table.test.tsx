import * as React from 'react';
import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import {
  ChunkyTable,
  ChunkyTableBody,
  ChunkyTableCell,
  ChunkyTableHeader,
  ChunkyTableHeaderCell,
  ChunkyTableIndexBadge,
  ChunkyTableRow,
  ChunkyTableToolbar,
} from '@/components/ui/chunky-table';

describe('ChunkyTable primitives', () => {
  it('composes table, header, body, row, and cell containers', () => {
    renderWithProviders(
      <ChunkyTable data-testid="chunky-table">
        <ChunkyTableHeader data-testid="chunky-header">
          <ChunkyTableHeaderCell>Title</ChunkyTableHeaderCell>
        </ChunkyTableHeader>
        <ChunkyTableBody data-testid="chunky-body">
          <ChunkyTableRow data-testid="chunky-row">
            <ChunkyTableCell data-testid="chunky-cell">Cyberpunk</ChunkyTableCell>
          </ChunkyTableRow>
        </ChunkyTableBody>
      </ChunkyTable>
    );
    expect(screen.getByTestId('chunky-table')).toBeInTheDocument();
    expect(screen.getByTestId('chunky-header')).toBeInTheDocument();
    expect(screen.getByTestId('chunky-body')).toBeInTheDocument();
    expect(screen.getByTestId('chunky-row')).toBeInTheDocument();
    expect(screen.getByTestId('chunky-cell')).toHaveTextContent('Cyberpunk');
  });

  it('forwards refs and arbitrary HTML div props on rows for drag-and-drop integration', () => {
    const ref = React.createRef<HTMLDivElement>();
    renderWithProviders(
      <ChunkyTableBody>
        <ChunkyTableRow
          ref={ref}
          data-testid="drag-row"
          data-draggable-id="episode-1"
          aria-label="Draggable episode row"
          role="button"
          tabIndex={0}
        >
          <ChunkyTableCell>Episode 1</ChunkyTableCell>
        </ChunkyTableRow>
      </ChunkyTableBody>
    );
    const row = screen.getByTestId('drag-row');
    expect(ref.current).toBe(row);
    expect(row).toHaveAttribute('data-draggable-id', 'episode-1');
    expect(row).toHaveAttribute('aria-label', 'Draggable episode row');
    expect(row).toHaveAttribute('role', 'button');
    expect(row).toHaveAttribute('tabindex', '0');
  });

  it('applies tactile selected styles on rows', () => {
    renderWithProviders(
      <ChunkyTableBody>
        <ChunkyTableRow selected data-testid="selected-row">
          <ChunkyTableCell>Selected</ChunkyTableCell>
        </ChunkyTableRow>
      </ChunkyTableBody>
    );
    const row = screen.getByTestId('selected-row');
    expect(row).toHaveAttribute('data-selected', 'true');
    expect(row.className).toContain('border-[var(--green)]');
    expect(row.className).toContain('bg-[var(--green-soft)]');
  });

  it('applies hover-lift styles on interactive rows', () => {
    renderWithProviders(
      <ChunkyTableBody>
        <ChunkyTableRow interactive data-testid="interactive-row">
          <ChunkyTableCell>Interactive</ChunkyTableCell>
        </ChunkyTableRow>
      </ChunkyTableBody>
    );
    const row = screen.getByTestId('interactive-row');
    expect(row.className).toContain('cursor-pointer');
    expect(row.className).toContain('hover:-translate-y-[2px]');
    expect(row.className).toContain('hover:shadow-lg');
  });

  it('applies dragging elevation and opacity styles while dragging', () => {
    renderWithProviders(
      <ChunkyTableBody>
        <ChunkyTableRow dragging data-testid="dragging-row">
          <ChunkyTableCell>Dragging</ChunkyTableCell>
        </ChunkyTableRow>
      </ChunkyTableBody>
    );
    const row = screen.getByTestId('dragging-row');
    expect(row).toHaveAttribute('data-dragging', 'true');
    expect(row.className).toContain('shadow-lg');
    expect(row.className).toContain('opacity-90');
  });

  it('renders ascending sort arrow and fires onSort when clicked', async () => {
    const onSort = vi.fn();
    const { user } = renderWithProviders(
      <ChunkyTableHeader>
        <ChunkyTableHeaderCell
          sortable
          sortDirection="asc"
          onSort={onSort}
        >
          Title
        </ChunkyTableHeaderCell>
      </ChunkyTableHeader>
    );
    const header = screen.getByRole('button', { name: /title/i });
    expect(header).toHaveTextContent('↑');
    await user.click(header);
    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it('renders descending and unsorted sort arrows', () => {
    renderWithProviders(
      <ChunkyTableHeader>
        <ChunkyTableHeaderCell sortable sortDirection="desc">
          Size
        </ChunkyTableHeaderCell>
        <ChunkyTableHeaderCell sortable sortDirection={null}>
          Files
        </ChunkyTableHeaderCell>
      </ChunkyTableHeader>
    );
    expect(screen.getByRole('button', { name: /size/i })).toHaveTextContent(
      '↓'
    );
    expect(screen.getByRole('button', { name: /files/i })).toHaveTextContent(
      '↕'
    );
  });

  it('renders non-sortable header cells without a button role', () => {
    renderWithProviders(
      <ChunkyTableHeader>
        <ChunkyTableHeaderCell>Actions</ChunkyTableHeaderCell>
      </ChunkyTableHeader>
    );
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders index badge numbers with 3D tactile borders', () => {
    renderWithProviders(<ChunkyTableIndexBadge index={1} />);
    const badge = screen.getByText('1');
    expect(badge).toHaveTextContent('1');
    expect(badge.className).toContain('border-2');
    expect(badge.className).toContain('border-b-4');
    expect(badge.className).toContain('text-[var(--blue)]');
  });

  it('renders toolbar container hosting search controls', () => {
    renderWithProviders(
      <ChunkyTableToolbar data-testid="chunky-toolbar">
        <input placeholder="Search series..." />
      </ChunkyTableToolbar>
    );
    expect(screen.getByTestId('chunky-toolbar')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search series...')
    ).toBeInTheDocument();
  });
});
