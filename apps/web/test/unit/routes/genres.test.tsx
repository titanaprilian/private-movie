import { renderWithProviders, screen } from '../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, GenresPage } from '@/routes/genres';
import { setAccessToken } from '@/lib/api';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
}));

describe('/genres route', () => {
  beforeEach(() => {
    setAccessToken('test-token');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          data: [
            {
              id: '1',
              name: 'Action',
              slug: 'action',
              createdAt: '2026-08-01',
              updatedAt: '2026-08-01',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
  });

  it('exports Route configuration', () => {
    expect(Route).toBeDefined();
  });

  it('renders GenresPage component', async () => {
    renderWithProviders(<GenresPage />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Genre Management' })
    ).toBeInTheDocument();
    expect(await screen.findByText('Action')).toBeInTheDocument();
  });
});
