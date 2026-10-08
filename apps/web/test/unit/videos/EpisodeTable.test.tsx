import { renderWithProviders, fireEvent, screen, userEvent, within } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { EpisodeTable } from '@/modules/videos/internal/seasons/EpisodeTable';
import type { Episode } from '@/modules/videos/internal/api';
import { DragDropContext } from '@hello-pangea/dnd';

const mockEpisodes: Episode[] = [
  {
    id: 'ep-1',
    title: 'Episode 1: The Beginning',
    order: 1,
    duration: '24:15',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    description: 'An exciting start to our story and adventures.',
    videoSources: [
      { id: 'vs-1', type: 'direct', url: 'https://stream.example/1.mp4', label: '1080p' },
      { id: 'vs-2', type: 'embed', url: 'https://embed.example/1', label: 'Mirror' },
    ],
  },
  {
    id: 'ep-2',
    title: 'Episode 2: The Challenge',
    order: 2,
    duration: '22:30',
    createdAt: '2026-01-08T00:00:00.000Z',
    updatedAt: '2026-01-08T00:00:00.000Z',
    description: 'Facing difficult hurdles along the way.',
    videoSources: [],
  },
  {
    id: 'ep-3',
    title: 'Episode 3: The Climax',
    order: 3,
    duration: '01:05:00',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    description: 'The decisive final confrontation.',
    videoSources: [
      { id: 'vs-3', type: 'direct', url: 'https://stream.example/3.mp4', label: '4K' },
    ],
  },
];

function renderEpisodeTable(props: Partial<React.ComponentProps<typeof EpisodeTable>> = {}) {
  return renderWithProviders(
    <DragDropContext onDragEnd={vi.fn()}>
      <EpisodeTable
        episodes={mockEpisodes}
        {...props}
      />
    </DragDropContext>
  );
}

describe('EpisodeTable Component', () => {
  it('renders all table columns: checkbox, grip, order, title, duration, sources, status, release date, and kebab action menu', () => {
    const { container } = renderEpisodeTable();

    // Table header container and items
    const header = container.querySelector('.ep-head');
    expect(header).toBeInTheDocument();
    expect(within(header as HTMLElement).getByRole('checkbox', { name: /select all visible episodes/i })).toBeInTheDocument();
    expect(within(header as HTMLElement).getByText('#')).toBeInTheDocument();
    expect(within(header as HTMLElement).getByText('Title')).toBeInTheDocument();
    expect(within(header as HTMLElement).getByText('Duration')).toBeInTheDocument();
    expect(within(header as HTMLElement).getByText('Sources')).toBeInTheDocument();
    expect(within(header as HTMLElement).getByText('Status')).toBeInTheDocument();
    expect(within(header as HTMLElement).getByText('Release Date')).toBeInTheDocument();

    // Header must have 9 in-flow columns matching each body row
    // (grip + kebab placeholders stay in grid flow via aria-hidden spans,
    // never sr-only which would collapse the tracks)
    expect(header!.children).toHaveLength(9);
    const firstRow = container.querySelector('.ep-list .ep');
    expect(firstRow).toBeInTheDocument();
    expect(firstRow!.children).toHaveLength(9);

    // CSS Grid container
    const epList = container.querySelector('.ep-list');
    expect(epList).toBeInTheDocument();

    // Episodes rendered
    expect(screen.getByText('Episode 1: The Beginning')).toBeInTheDocument();
    expect(screen.getByText('Episode 2: The Challenge')).toBeInTheDocument();
    expect(screen.getByText('Episode 3: The Climax')).toBeInTheDocument();

    // Sources and Status Badges
    expect(screen.getByText('24 min')).toBeInTheDocument();
    expect(screen.getByText('22 min')).toBeInTheDocument();
    expect(screen.getByText('1h 5 min')).toBeInTheDocument();

    expect(screen.getAllByText('Ready')).toHaveLength(2);
    expect(screen.getByText('No Stream')).toBeInTheDocument();

    // Release dates
    expect(screen.getByText('2026-01-01')).toBeInTheDocument();
    expect(screen.getByText('2026-01-08')).toBeInTheDocument();
    expect(screen.getByText('2026-01-15')).toBeInTheDocument();
  });

  it('filters episodes in real-time by title and description', async () => {
    const user = userEvent.setup();
    renderEpisodeTable();

    const searchInput = screen.getByRole('textbox', { name: /search episodes/i });

    // Filter by title
    await user.type(searchInput, 'Beginning');
    expect(screen.getByText('Episode 1: The Beginning')).toBeInTheDocument();
    expect(screen.queryByText('Episode 2: The Challenge')).not.toBeInTheDocument();
    expect(screen.queryByText('Episode 3: The Climax')).not.toBeInTheDocument();

    // Filter by description
    await user.clear(searchInput);
    await user.type(searchInput, 'hurdles');
    expect(screen.queryByText('Episode 1: The Beginning')).not.toBeInTheDocument();
    expect(screen.getByText('Episode 2: The Challenge')).toBeInTheDocument();
    expect(screen.queryByText('Episode 3: The Climax')).not.toBeInTheDocument();

    // No match
    await user.clear(searchInput);
    await user.type(searchInput, 'nonexistent-query');
    expect(screen.getByText('No episodes match your search.')).toBeInTheDocument();
  });

  it('sorts episodes by Order, Title, Duration, and Release Date upon column header click', async () => {
    const user = userEvent.setup();
    const { container } = renderEpisodeTable();

    const getRenderedTitles = () =>
      Array.from(container.querySelectorAll('.ep .ep-title'))
        .map((el) => el.textContent?.trim())
        .filter(Boolean);

    // Initial order (order asc)
    expect(getRenderedTitles()).toEqual([
      'Episode 1: The Beginning',
      'Episode 2: The Challenge',
      'Episode 3: The Climax',
    ]);

    // Sort by order desc
    const orderHeaderBtn = screen.getByRole('button', { name: /#.*↑/i });
    await user.click(orderHeaderBtn);
    expect(getRenderedTitles()).toEqual([
      'Episode 3: The Climax',
      'Episode 2: The Challenge',
      'Episode 1: The Beginning',
    ]);

    // Sort by title asc
    const titleHeaderBtn = screen.getByRole('button', { name: /title/i });
    await user.click(titleHeaderBtn);
    expect(getRenderedTitles()).toEqual([
      'Episode 1: The Beginning',
      'Episode 2: The Challenge',
      'Episode 3: The Climax',
    ]);

    // Sort by title desc
    await user.click(titleHeaderBtn);
    expect(getRenderedTitles()).toEqual([
      'Episode 3: The Climax',
      'Episode 2: The Challenge',
      'Episode 1: The Beginning',
    ]);

    // Sort by duration asc (22:30, 24:15, 01:05:00)
    const durationHeaderBtn = screen.getByRole('button', { name: /duration/i });
    await user.click(durationHeaderBtn);
    expect(getRenderedTitles()).toEqual([
      'Episode 2: The Challenge', // 22:30
      'Episode 1: The Beginning', // 24:15
      'Episode 3: The Climax',    // 01:05:00
    ]);

    // Sort by release date desc
    const dateHeaderBtn = screen.getByRole('button', { name: /release date/i });
    await user.click(dateHeaderBtn); // asc
    await user.click(dateHeaderBtn); // desc
    expect(getRenderedTitles()).toEqual([
      'Episode 3: The Climax',
      'Episode 2: The Challenge',
      'Episode 1: The Beginning',
    ]);
  });

  it('disables drag-and-drop and shows warning indicator with chunky tooltip when sorting or filtering is active', async () => {
    const user = userEvent.setup();
    renderEpisodeTable();

    // Default state: not disabled
    expect(screen.queryByText('Reordering disabled')).not.toBeInTheDocument();
    const handle1 = screen.getByLabelText('Reorder Episode 1: The Beginning');
    expect(handle1).not.toHaveAttribute('title');
    expect(handle1).not.toHaveClass('cursor-not-allowed');

    // Hovering the grip reveals the chunky "Drag to reorder" tooltip
    await user.hover(handle1);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Drag to reorder'
    );
    await user.unhover(handle1);

    // Activate sorting
    const titleHeaderBtn = screen.getByRole('button', { name: /title/i });
    await user.click(titleHeaderBtn);

    expect(screen.getByText('Reordering disabled')).toBeInTheDocument();
    const badge = screen.getByText('Reordering disabled');
    expect(badge.closest('div')).not.toHaveAttribute('title');
    // Hovering the badge explains why reordering is disabled
    await user.hover(badge);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /custom sorting/i
    );
    expect(screen.getByLabelText('Reorder Episode 1: The Beginning')).toHaveClass('cursor-not-allowed');

    // Reset sort back to order asc
    const orderHeaderBtn = screen.getByRole('button', { name: /#/i });
    await user.click(orderHeaderBtn); // order asc
    expect(screen.queryByText('Reordering disabled')).not.toBeInTheDocument();

    // Activate search query
    const searchInput = screen.getByRole('textbox', { name: /search episodes/i });
    await user.type(searchInput, 'Episode');
    expect(screen.getByText('Reordering disabled')).toBeInTheDocument();
    await user.hover(screen.getByText('Reordering disabled'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /search filter is active/i
    );
  });

  it('triggers onSelectEpisode, onEditEpisode, onManageSources, and onDeleteEpisode callbacks', async () => {
    const user = userEvent.setup();
    const onSelectEpisode = vi.fn();
    const onEditEpisode = vi.fn();
    const onDeleteEpisode = vi.fn();
    const onManageSources = vi.fn();

    renderEpisodeTable({
      onSelectEpisode,
      onEditEpisode,
      onDeleteEpisode,
      onManageSources,
    });

    // Row click triggers onSelectEpisode
    const epRow = screen.getByText('Episode 1: The Beginning');
    await user.click(epRow);
    expect(onSelectEpisode).toHaveBeenCalledWith(mockEpisodes[0]);

    // Open action menu
    const menuBtn = screen.getByRole('button', { name: 'Actions for Episode 1: The Beginning' });
    await user.click(menuBtn);

    // Edit
    const editBtn = await screen.findByRole('menuitem', { name: /^edit$/i });
    await user.click(editBtn);
    expect(onEditEpisode).toHaveBeenCalledWith(mockEpisodes[0]);
    expect(screen.queryByRole('menuitem', { name: /^edit$/i })).not.toBeInTheDocument();

    // Manage Sources
    await user.click(menuBtn);
    const sourcesBtn = await screen.findByRole('menuitem', { name: /^sources$/i });
    await user.click(sourcesBtn);
    expect(onManageSources).toHaveBeenCalledWith(mockEpisodes[0]);
    expect(screen.queryByRole('menuitem', { name: /^sources$/i })).not.toBeInTheDocument();

    // Delete
    await user.click(menuBtn);
    const deleteBtn = await screen.findByRole('menuitem', { name: /^delete$/i });
    await user.click(deleteBtn);
    expect(onDeleteEpisode).toHaveBeenCalledWith(mockEpisodes[0]);
    expect(screen.queryByRole('menuitem', { name: /^delete$/i })).not.toBeInTheDocument();
  });

  it('supports selecting individual rows with green highlight and header indeterminate state', async () => {
    const user = userEvent.setup();

    const { container } = renderEpisodeTable();

    // Select row 1
    const checkbox1 = screen.getByLabelText('Select Episode 1: The Beginning');
    await user.click(checkbox1);

    // First card has .sel class
    const firstCard = container.querySelector('.ep');
    expect(firstCard).toHaveClass('sel');

    // Header shows indeterminate state
    const headerCheckbox = screen.getByLabelText('Select all visible episodes');
    expect(headerCheckbox).toHaveAttribute('aria-checked', 'mixed');

    // Select row 2
    const checkbox2 = screen.getByLabelText('Select Episode 2: The Challenge');
    await user.click(checkbox2);
    expect(container.querySelectorAll('.ep.sel')).toHaveLength(2);

    // Deselect row 1
    await user.click(checkbox1);
    expect(container.querySelectorAll('.ep.sel')).toHaveLength(1);
  });

  it('handles select all and partial selection indeterminate state on the table header checkbox', async () => {
    const user = userEvent.setup();
    const { container } = renderEpisodeTable();

    const headerCheckbox = screen.getByLabelText('Select all visible episodes');
    expect(headerCheckbox).toHaveAttribute('aria-checked', 'false');
    expect(headerCheckbox).toHaveAttribute('data-state', 'unchecked');

    // Select 1 item (partial selection)
    const checkbox1 = screen.getByLabelText('Select Episode 1: The Beginning');
    await user.click(checkbox1);

    expect(headerCheckbox).toHaveAttribute('aria-checked', 'mixed');
    expect(headerCheckbox).toHaveAttribute('data-state', 'indeterminate');

    // Click header checkbox -> should select all 3
    await user.click(headerCheckbox);
    expect(container.querySelectorAll('.ep.sel')).toHaveLength(3);
    expect(headerCheckbox).toHaveAttribute('aria-checked', 'true');
    expect(headerCheckbox).toHaveAttribute('data-state', 'checked');

    // Click header checkbox again -> should unselect all
    await user.click(headerCheckbox);
    expect(container.querySelectorAll('.ep.sel')).toHaveLength(0);
    expect(headerCheckbox).toHaveAttribute('aria-checked', 'false');
    expect(headerCheckbox).toHaveAttribute('data-state', 'unchecked');
  });

  it('disables drag-and-drop when multiple rows are selected', async () => {
    const user = userEvent.setup();
    renderEpisodeTable();

    const handle1 = screen.getByLabelText('Reorder Episode 1: The Beginning');
    expect(handle1).not.toHaveClass('cursor-not-allowed');

    // Select 1 item -> DnD is still enabled if not filtered/sorted
    const checkbox1 = screen.getByLabelText('Select Episode 1: The Beginning');
    await user.click(checkbox1);
    expect(handle1).not.toHaveClass('cursor-not-allowed');

    // Select 2nd item -> DnD becomes disabled
    const checkbox2 = screen.getByLabelText('Select Episode 2: The Challenge');
    await user.click(checkbox2);

    expect(screen.getByText('Reordering disabled')).toBeInTheDocument();
    await user.hover(screen.getByText('Reordering disabled'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /multiple episodes are selected/i
    );
    expect(handle1).toHaveClass('cursor-not-allowed');
  });

  it('selects a top-to-bottom range with Shift-click', async () => {
    const user = userEvent.setup();
    const onSelectedEpisodeIdsChange = vi.fn();
    const { container } = renderEpisodeTable({ onSelectedEpisodeIdsChange });

    const checkbox1 = screen.getByLabelText('Select Episode 1: The Beginning');
    await user.click(checkbox1);
    expect(container.querySelectorAll('.ep.sel')).toHaveLength(1);

    const checkbox3 = screen.getByLabelText('Select Episode 3: The Climax');
    fireEvent.click(checkbox3, { shiftKey: true });

    expect(container.querySelectorAll('.ep.sel')).toHaveLength(3);
    expect(onSelectedEpisodeIdsChange).toHaveBeenLastCalledWith(['ep-1', 'ep-2', 'ep-3']);
  });

  it('selects a bottom-to-top range with Shift-click', async () => {
    const user = userEvent.setup();
    const { container } = renderEpisodeTable();

    const checkbox3 = screen.getByLabelText('Select Episode 3: The Climax');
    await user.click(checkbox3);

    const checkbox1 = screen.getByLabelText('Select Episode 1: The Beginning');
    fireEvent.click(checkbox1, { shiftKey: true });

    expect(container.querySelectorAll('.ep.sel')).toHaveLength(3);
  });

  it('Shift-click with no prior anchor selects only the clicked episode', async () => {
    const { container } = renderEpisodeTable();

    const checkbox2 = screen.getByLabelText('Select Episode 2: The Challenge');
    fireEvent.click(checkbox2, { shiftKey: true });

    expect(container.querySelectorAll('.ep.sel')).toHaveLength(1);
    // Header reflects partial selection
    expect(screen.getByLabelText('Select all visible episodes')).toHaveAttribute('aria-checked', 'mixed');
  });

  it('Shift-click deselects the range when the clicked row is already selected', async () => {
    const user = userEvent.setup();
    const { container } = renderEpisodeTable();

    // Select all three first
    const headerCheckbox = screen.getByLabelText('Select all visible episodes');
    await user.click(headerCheckbox);
    expect(container.querySelectorAll('.ep.sel')).toHaveLength(3);

    // Normal click on row 1 deselects it and sets the anchor
    const checkbox1 = screen.getByLabelText('Select Episode 1: The Beginning');
    await user.click(checkbox1);
    expect(container.querySelectorAll('.ep.sel')).toHaveLength(2);

    // Shift-click row 3 (currently selected) deselects the whole range
    const checkbox3 = screen.getByLabelText('Select Episode 3: The Climax');
    fireEvent.click(checkbox3, { shiftKey: true });
    expect(container.querySelectorAll('.ep.sel')).toHaveLength(0);
  });

  it('range selection follows the visible sort order', async () => {
    const user = userEvent.setup();
    const onSelectedEpisodeIdsChange = vi.fn();
    const { container } = renderEpisodeTable({ onSelectedEpisodeIdsChange });

    // Sort order desc: visible rows are ep-3, ep-2, ep-1
    const orderHeaderBtn = screen.getByRole('button', { name: /#.*↑/i });
    await user.click(orderHeaderBtn);

    const checkbox3 = screen.getByLabelText('Select Episode 3: The Climax');
    await user.click(checkbox3);

    const checkbox2 = screen.getByLabelText('Select Episode 2: The Challenge');
    fireEvent.click(checkbox2, { shiftKey: true });

    expect(container.querySelectorAll('.ep.sel')).toHaveLength(2);
    expect(onSelectedEpisodeIdsChange).toHaveBeenLastCalledWith(['ep-3', 'ep-2']);
  });

  it('range selection only affects rows visible under the active filter', async () => {
    const user = userEvent.setup();
    const onSelectedEpisodeIdsChange = vi.fn();
    const { container } = renderEpisodeTable({ onSelectedEpisodeIdsChange });

    // Filter down to a single visible row
    const searchInput = screen.getByRole('textbox', { name: /search episodes/i });
    await user.type(searchInput, 'Challenge');
    expect(screen.queryByText('Episode 1: The Beginning')).not.toBeInTheDocument();

    const checkbox2 = screen.getByLabelText('Select Episode 2: The Challenge');
    await user.click(checkbox2);

    // Shift-click the same (only) visible row toggles just it off
    fireEvent.click(checkbox2, { shiftKey: true });
    expect(container.querySelectorAll('.ep.sel')).toHaveLength(0);
    expect(onSelectedEpisodeIdsChange).toHaveBeenLastCalledWith([]);
  });
});
