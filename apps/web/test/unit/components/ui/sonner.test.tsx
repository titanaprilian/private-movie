import { Toaster } from '@/components/ui/sonner';
import { renderWithProviders, screen, act } from '../../../utils';
import { describe, expect, it } from 'vitest';
import { toast } from 'sonner';

describe('Sonner Toaster component', () => {
  it('renders Toaster component without crashing', () => {
    const { container } = renderWithProviders(<Toaster />);
    expect(container).toBeInTheDocument();
  });

  it('renders section container with passed props', () => {
    const { container } = renderWithProviders(<Toaster position="top-right" />);
    const section =
      container.querySelector('section') || document.querySelector('section');
    expect(section).toBeInTheDocument();
  });

  it('renders success toast with SVG icon, border color, and custom class mapping', async () => {
    renderWithProviders(<Toaster />);
    act(() => {
      toast.success('item.create', { description: 'item created successfully' });
    });

    const toastElement = await screen.findByText('item.create');
    expect(toastElement).toBeInTheDocument();
    const descriptionElement = screen.getByText('item created successfully');
    expect(descriptionElement).toBeInTheDocument();

    const toastCard = toastElement.closest('[data-sonner-toast]') || toastElement.closest('li');
    expect(toastCard).toHaveAttribute('data-type', 'success');
    expect(toastCard?.className).toContain('toast');
    expect(toastCard?.className).toContain('mono');

    const icon = toastCard?.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon?.getAttribute('stroke')).toBe('#22c55e');
  });

  it('renders error toast with SVG icon and border color', async () => {
    renderWithProviders(<Toaster />);
    act(() => {
      toast.error('auth.login', { description: 'invalid credentials' });
    });

    const toastElement = await screen.findByText('auth.login');
    expect(toastElement).toBeInTheDocument();
    expect(screen.getByText('invalid credentials')).toBeInTheDocument();

    const toastCard = toastElement.closest('[data-sonner-toast]') || toastElement.closest('li');
    expect(toastCard).toHaveAttribute('data-type', 'error');

    const icon = toastCard?.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon?.getAttribute('stroke')).toBe('#ef4444');
  });

  it('renders info toast with SVG icon and border color', async () => {
    renderWithProviders(<Toaster />);
    act(() => {
      toast.info('sync', { description: 'workspace up to date' });
    });

    const toastElement = await screen.findByText('sync');
    expect(toastElement).toBeInTheDocument();
    expect(screen.getByText('workspace up to date')).toBeInTheDocument();

    const toastCard = toastElement.closest('[data-sonner-toast]') || toastElement.closest('li');
    expect(toastCard).toHaveAttribute('data-type', 'info');

    const icon = toastCard?.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon?.getAttribute('stroke')).toBe('#818cf8');
  });

  it('renders warning toast with SVG icon and border color', async () => {
    renderWithProviders(<Toaster />);
    act(() => {
      toast.warning('session', { description: 'expires in 5 minutes' });
    });

    const toastElement = await screen.findByText('session');
    expect(toastElement).toBeInTheDocument();
    expect(screen.getByText('expires in 5 minutes')).toBeInTheDocument();

    const toastCard = toastElement.closest('[data-sonner-toast]') || toastElement.closest('li');
    expect(toastCard).toHaveAttribute('data-type', 'warning');

    const icon = toastCard?.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon?.getAttribute('stroke')).toBe('#f59e0b');
  });
});
