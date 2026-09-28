import { useState } from 'react';
import { queryOptions } from '@tanstack/react-query';
import { createTestQueryClient, renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GenreFilter } from '@/modules/videos';
import type { Genre } from '@/modules/genres';

const { mockedFetchGenres } = vi.hoisted(() => ({
  mockedFetchGenres: vi.fn<() => Promise<Genre[]>>(),
}));

vi.mock('@/modules/genres', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/modules/genres')>();
  return {
    ...mod,
    genresQueryOptions: () =>
      queryOptions({ queryKey: ['genres'], queryFn: () => mockedFetchGenres() }),
  };
});

const mockGenres: Genre[] = [
  { id: 'g-1', name: 'Action', slug: 'action', isBigGenre: true, displayOrder: 0 },
  { id: 'g-2', name: 'Comedy', slug: 'comedy', isBigGenre: false, displayOrder: 1 },
  { id: 'g-3', name: 'Drama', slug: 'drama', isBigGenre: false, displayOrder: 2 },
];

function Harness({ initial = [] as string[] }: { initial?: string[] }) {
  const [slugs, setSlugs] = useState<string[]>(initial);
  return <GenreFilter selectedSlugs={slugs} onSelectionChange={setSlugs} />;
}

function renderGenreFilter(initial: string[] = [], genres: Genre[] = mockGenres) {
  mockedFetchGenres.mockResolvedValue(genres);
  const queryClient = createTestQueryClient();
  return renderWithProviders(<Harness initial={initial} />, { queryClient });
}

async function openPanel(user: { click: (el: Element) => Promise<void> }, name = 'Filter by genre') {
  await user.click(await screen.findByRole('combobox', { name }));
  expect(await screen.findByPlaceholderText('Search genres...')).toBeInTheDocument();
  for (const genre of mockGenres) {
    expect(await screen.findByRole('option', { name: genre.name })).toBeInTheDocument();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GenreFilter trigger', () => {
  it('behaves as a combobox with listbox popup semantics', async () => {
    const { user } = renderGenreFilter();
    const trigger = await screen.findByRole('combobox', { name: 'Filter by genre' });
    expect(trigger).toHaveTextContent('Filter by genre');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await openPanel(user);
    expect(screen.getByRole('combobox', { name: 'Filter by genre' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('shows the single selected genre name', async () => {
    renderGenreFilter(['action']);
    expect(await screen.findByRole('combobox', { name: 'Action' })).toHaveTextContent('Action');
  });

  it('shows "N genres" for multiple selections with green-tint active state', async () => {
    renderGenreFilter(['action', 'comedy']);
    const trigger = await screen.findByRole('combobox', { name: '2 genres' });
    expect(trigger).toHaveTextContent('2 genres');
    expect(trigger.className).toMatch('bg-[var(--green-soft)]');
    expect(trigger.className).toMatch('border-[var(--green)]');
  });

  it('rotates the chevron and shows a blue border while open', async () => {
    const { user } = renderGenreFilter();
    const trigger = await screen.findByRole('combobox', { name: 'Filter by genre' });
    const svgs = trigger.querySelectorAll('svg');
    // The last SVG is the chevron (Filter icon is first)
    const chevron = svgs[svgs.length - 1];
    expect(chevron?.className.baseVal ?? chevron?.getAttribute('class') ?? '').not.toMatch(
      'rotate-180'
    );

    await openPanel(user);

    const openTrigger = screen.getByRole('combobox', { name: 'Filter by genre' });
    expect(openTrigger.className).toMatch('border-[var(--blue)]');
    const openSvgs = openTrigger.querySelectorAll('svg');
    const openChevron = openSvgs[openSvgs.length - 1];
    expect(openChevron?.className.baseVal ?? '').toMatch('rotate-180');
  });
});

describe('GenreFilter panel', () => {
  it('opens without pre-highlighting any genre row', async () => {
    const { user } = renderGenreFilter();
    await openPanel(user);

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    for (const option of options) {
      expect(option).toHaveAttribute('aria-selected', 'false');
    }
  });

  it('filters rows by search text', async () => {
    const { user } = renderGenreFilter();
    await openPanel(user);

    const search = screen.getByPlaceholderText('Search genres...');
    await user.type(search, 'com');

    expect(screen.getByRole('option', { name: 'Comedy' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Action' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Drama' })).not.toBeInTheDocument();
  });

  it('clears highlight when the search input changes', async () => {
    const { user } = renderGenreFilter();
    await openPanel(user);

    const options = screen.getAllByRole('option');
    await user.hover(options[0]);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    await user.type(screen.getByPlaceholderText('Search genres...'), 'com');

    for (const option of screen.getAllByRole('option')) {
      expect(option).toHaveAttribute('aria-selected', 'false');
    }
  });

  it('highlights rows on arrow-key navigation', async () => {
    const { user } = renderGenreFilter();
    await openPanel(user);

    screen.getByPlaceholderText('Search genres...').focus();
    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('option', { name: 'Action' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('renders 24px chunky checkboxes with a white checkmark when selected', async () => {
    const { user } = renderGenreFilter(['action']);
    await openPanel(user, 'Action');

    const checkedBox = screen.getByTestId('genre-checkbox-action');
    expect(checkedBox.className).toMatch('h-6');
    expect(checkedBox.className).toMatch('w-6');
    expect(checkedBox.className).toMatch('bg-[var(--green)]');
    expect(checkedBox.querySelector('svg')).toBeInTheDocument();

    const uncheckedBox = screen.getByTestId('genre-checkbox-comedy');
    expect(uncheckedBox.querySelector('svg')).not.toBeInTheDocument();
  });

  it('toggles selection immediately on row click while keeping the panel open', async () => {
    const { user } = renderGenreFilter();
    await openPanel(user);

    await user.click(screen.getByRole('option', { name: 'Action' }));
    expect(await screen.findByRole('combobox', { name: 'Action' })).toBeInTheDocument();
    // Panel stays open for multi-selection
    expect(screen.getByPlaceholderText('Search genres...')).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'Comedy' }));
    expect(await screen.findByRole('combobox', { name: '2 genres' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search genres...')).toBeInTheDocument();
  });

  it('deselects an already-selected genre on second click', async () => {
    const { user } = renderGenreFilter(['action']);
    await openPanel(user, 'Action');

    await user.click(screen.getByRole('option', { name: 'Action' }));
    expect(await screen.findByRole('combobox', { name: 'Filter by genre' })).toBeInTheDocument();
  });

  it('clears all selections via the Clear button and keeps the panel open', async () => {
    const { user } = renderGenreFilter(['action', 'comedy']);
    await openPanel(user, '2 genres');

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(await screen.findByRole('combobox', { name: 'Filter by genre' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search genres...')).toBeInTheDocument();
  });

  it('closes via the Done button', async () => {
    const { user } = renderGenreFilter();
    await openPanel(user);

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByPlaceholderText('Search genres...')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by genre' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const { user } = renderGenreFilter();
    await openPanel(user);

    await user.keyboard('{Escape}');
    expect(screen.queryByPlaceholderText('Search genres...')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by genre' })).toHaveFocus();
  });

  it('closes on outside click', async () => {
    const { user } = renderGenreFilter();
    await openPanel(user);

    await user.click(document.body);
    expect(screen.queryByPlaceholderText('Search genres...')).not.toBeInTheDocument();
  });
});

describe('GenreFilter async states', () => {
  it('shows skeleton rows while genres load', async () => {
    mockedFetchGenres.mockImplementation(() => new Promise<Genre[]>(() => {}));
    const queryClient = createTestQueryClient();
    const { user } = renderWithProviders(<Harness />, { queryClient });

    await user.click(await screen.findByRole('combobox', { name: 'Filter by genre' }));
    expect(await screen.findByRole('status', { name: 'Loading genres' })).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('shows an error with retry that recovers the list', async () => {
    mockedFetchGenres.mockRejectedValueOnce(new Error('network down'));
    const queryClient = createTestQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false } });
    const { user } = renderWithProviders(<Harness />, { queryClient });

    await user.click(await screen.findByRole('combobox', { name: 'Filter by genre' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load genres');

    mockedFetchGenres.mockResolvedValue(mockGenres);
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('option', { name: 'Action' })).toBeInTheDocument();
  });
});
