import { renderWithProviders, screen, waitFor } from '../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenreManager } from '@/modules/genres';
import type { Genre } from '@/modules/genres/internal/api';
import { Toaster } from '@/components/ui/sonner';
import { setAccessToken } from '@/lib/api';

const mockGenres: Genre[] = [
  {
    id: 'g-1',
    name: 'Action & Adventure',
    slug: 'action-and-adventure',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'g-2',
    name: 'Comedy',
    slug: 'comedy',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'g-3',
    name: 'Sci-Fi & Fantasy',
    slug: 'sci-fi-and-fantasy',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
];

describe('GenreManager component', () => {
  let genresState: Genre[] = [];

  beforeEach(() => {
    genresState = [...mockGenres];
    setAccessToken('test-token');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method?.toUpperCase() ?? 'GET';

      if (url.endsWith('/api/genres') || url.includes('/genres')) {
        if (method === 'GET') {
          return new Response(JSON.stringify({ data: genresState }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (method === 'POST') {
          const body = JSON.parse((init?.body as string) || '{}');
          if (body.name === 'Conflict') {
            return new Response(
              JSON.stringify({
                error: {
                  code: 'GENRE_ALREADY_EXISTS',
                  message: 'Genre with this name or slug already exists',
                },
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } }
            );
          }
          const newGenre: Genre = {
            id: `g-${Date.now()}`,
            name: body.name,
            slug: body.slug,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          genresState.push(newGenre);
          return new Response(JSON.stringify({ data: newGenre }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      const matchId = url.match(/\/genres\/([^/?]+)/);
      if (matchId) {
        const id = matchId[1];
        if (method === 'PUT') {
          const body = JSON.parse((init?.body as string) || '{}');
          const index = genresState.findIndex((g) => g.id === id);
          if (index !== -1) {
            genresState[index] = {
              ...genresState[index],
              name: body.name,
              slug: body.slug,
              updatedAt: new Date().toISOString(),
            };
            return new Response(
              JSON.stringify({ data: genresState[index] }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }

        if (method === 'DELETE') {
          const index = genresState.findIndex((g) => g.id === id);
          if (index !== -1) {
            const [deleted] = genresState.splice(index, 1);
            return new Response(JSON.stringify({ data: deleted }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }
      }

      return new Response(
        JSON.stringify({
          error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    });
  });

  it('renders header, title, and data table with genres', async () => {
    renderWithProviders(<GenreManager />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Genre Management' })
    ).toBeInTheDocument();
    expect(await screen.findByText('Action & Adventure')).toBeInTheDocument();
    expect(screen.getByText('action-and-adventure')).toBeInTheDocument();
    expect(screen.getByText('Comedy')).toBeInTheDocument();
    expect(screen.getByText('Sci-Fi & Fantasy')).toBeInTheDocument();
  });

  it('renders empty state when no genres exist', async () => {
    genresState = [];
    renderWithProviders(<GenreManager />);

    expect(
      await screen.findByText(/no genres found/i)
    ).toBeInTheDocument();
  });

  it('filters genre list based on search term', async () => {
    const { user } = renderWithProviders(<GenreManager />);

    await screen.findByText('Action & Adventure');

    const searchInput = screen.getByPlaceholderText(/search genres/i);
    await user.type(searchInput, 'Comedy');

    expect(screen.getByText('Comedy')).toBeInTheDocument();
    expect(screen.queryByText('Action & Adventure')).not.toBeInTheDocument();
    expect(screen.queryByText('Sci-Fi & Fantasy')).not.toBeInTheDocument();
  });

  it('opens Create Genre modal, auto-generates slug, and creates genre', async () => {
    const { user } = renderWithProviders(
      <>
        <GenreManager />
        <Toaster />
      </>
    );

    await screen.findByText('Action & Adventure');

    const createBtn = screen.getByRole('button', { name: /create genre/i });
    await user.click(createBtn);

    expect(
      await screen.findByRole('heading', { name: 'Create New Genre' })
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/genre name/i);
    const slugInput = screen.getByLabelText(/slug/i) as HTMLInputElement;

    await user.type(nameInput, 'Romance & Drama');
    expect(slugInput.value).toBe('romance-and-drama');

    const submitBtn = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Romance & Drama')).toBeInTheDocument();
    });
    expect(screen.getByText('romance-and-drama')).toBeInTheDocument();
  });

  it('opens Edit Genre modal and renames genre', async () => {
    const { user } = renderWithProviders(
      <>
        <GenreManager />
        <Toaster />
      </>
    );

    await screen.findByText('Comedy');

    const editBtns = screen.getAllByRole('button', { name: /edit genre/i });
    await user.click(editBtns[1]); // Edit 'Comedy'

    expect(
      await screen.findByRole('heading', { name: 'Edit Genre' })
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/genre name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Comedy');

    await user.clear(nameInput);
    await user.type(nameInput, 'Dark Comedy');

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Dark Comedy')).toBeInTheDocument();
    });
    expect(screen.getByText('dark-comedy')).toBeInTheDocument();
  });

  it('opens Delete dialog and removes genre', async () => {
    const { user } = renderWithProviders(
      <>
        <GenreManager />
        <Toaster />
      </>
    );

    await screen.findByText('Comedy');

    const deleteBtns = screen.getAllByRole('button', { name: /delete genre/i });
    await user.click(deleteBtns[1]); // Delete 'Comedy'

    expect(
      await screen.findByRole('heading', { name: 'Delete Genre' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/are you sure you want to delete "comedy"\?/i)
    ).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole('button', { name: /^delete$/i });
    await user.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(screen.queryByText('Comedy')).not.toBeInTheDocument();
    });
  });

  it('displays error message when genre creation fails', async () => {
    const { user } = renderWithProviders(
      <>
        <GenreManager />
        <Toaster />
      </>
    );

    await screen.findByText('Action & Adventure');

    const createBtn = screen.getByRole('button', { name: /create genre/i });
    await user.click(createBtn);

    const nameInput = screen.getByLabelText(/genre name/i);
    await user.type(nameInput, 'Conflict');

    const submitBtn = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Genre with this name or slug already exists')
      ).toBeInTheDocument();
    });
  });
});
