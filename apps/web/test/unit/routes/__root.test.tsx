import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '../../utils';
import { Route } from '@/routes/__root';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    createRootRoute: (config: unknown) => config,
    Outlet: () => <div data-testid="root-outlet">Public Content</div>,
  };
});

describe('__root route layout', () => {
  it('renders root container mounting only Outlet and Toaster without Shell or admin chrome', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const RootComponent = (Route as any).component;
    expect(RootComponent).toBeDefined();

    renderWithProviders(<RootComponent />);

    expect(screen.getByTestId('root-outlet')).toBeInTheDocument();
    expect(screen.getByText('Public Content')).toBeInTheDocument();

    // Verify admin shell elements and links are not rendered in root
    expect(screen.queryByRole('link', { name: /^series$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^genres$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^storage$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /toggle sidebar/i })).not.toBeInTheDocument();
  });
});
