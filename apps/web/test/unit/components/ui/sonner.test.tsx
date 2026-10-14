import { Toaster } from '@/components/ui/sonner';
import { Toaster as ChunkyToaster } from '@/components/ui/chunky-sonner';
import { renderWithProviders, screen, act } from '../../../utils';
import { describe, expect, it } from 'vitest';
import { toast } from 'sonner';

describe('Sonner Toaster component (chunky re-export)', () => {
  it('re-exports the chunky Toaster implementation', () => {
    expect(Toaster).toBe(ChunkyToaster);
  });

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

  it('renders success toast with chunky markup, Lucide icon, and green border', async () => {
    renderWithProviders(<Toaster />);
    act(() => {
      toast.success('item.create', {
        description: 'item created successfully',
      });
    });

    const toastElement = await screen.findByText('item.create');
    expect(toastElement).toBeInTheDocument();
    const descriptionElement = screen.getByText('item created successfully');
    expect(descriptionElement).toBeInTheDocument();

    const toastCard =
      toastElement.closest('[data-sonner-toast]') || toastElement.closest('li');
    expect(toastCard).toHaveAttribute('data-type', 'success');
    expect(toastCard?.className).toContain('toast');
    expect(toastCard?.className).toContain('border-2');
    expect(toastCard?.className).toContain('border-b-4');
    expect(toastCard?.className).toContain('rounded-2xl');
    expect(toastCard?.className).toContain('bg-[var(--surface)]');
    expect(toastCard?.className).toContain('border-[var(--green)]');
    expect(toastCard?.className).toContain('border-b-[var(--green-dark)]');

    const icon = toastCard?.querySelector('.toast-icon-success');
    expect(icon).toBeInTheDocument();
    expect(icon?.tagName.toLowerCase()).toBe('svg');
  });

  it('renders error toast with Lucide icon and red border', async () => {
    renderWithProviders(<Toaster />);
    act(() => {
      toast.error('auth.login', { description: 'invalid credentials' });
    });

    const toastElement = await screen.findByText('auth.login');
    expect(toastElement).toBeInTheDocument();
    expect(screen.getByText('invalid credentials')).toBeInTheDocument();

    const toastCard =
      toastElement.closest('[data-sonner-toast]') || toastElement.closest('li');
    expect(toastCard).toHaveAttribute('data-type', 'error');
    expect(toastCard?.className).toContain('border-[var(--red)]');

    const icon = toastCard?.querySelector('.toast-icon-error');
    expect(icon).toBeInTheDocument();
    expect(icon?.tagName.toLowerCase()).toBe('svg');
  });

  it('renders info toast with Lucide icon and blue border', async () => {
    renderWithProviders(<Toaster />);
    act(() => {
      toast.info('sync', { description: 'workspace up to date' });
    });

    const toastElement = await screen.findByText('sync');
    expect(toastElement).toBeInTheDocument();
    expect(screen.getByText('workspace up to date')).toBeInTheDocument();

    const toastCard =
      toastElement.closest('[data-sonner-toast]') || toastElement.closest('li');
    expect(toastCard).toHaveAttribute('data-type', 'info');
    expect(toastCard?.className).toContain('border-[var(--blue)]');

    const icon = toastCard?.querySelector('.toast-icon-info');
    expect(icon).toBeInTheDocument();
    expect(icon?.tagName.toLowerCase()).toBe('svg');
  });

  it('renders warning toast with Lucide icon and gold border', async () => {
    renderWithProviders(<Toaster />);
    act(() => {
      toast.warning('session', { description: 'expires in 5 minutes' });
    });

    const toastElement = await screen.findByText('session');
    expect(toastElement).toBeInTheDocument();
    expect(screen.getByText('expires in 5 minutes')).toBeInTheDocument();

    const toastCard =
      toastElement.closest('[data-sonner-toast]') || toastElement.closest('li');
    expect(toastCard).toHaveAttribute('data-type', 'warning');
    expect(toastCard?.className).toContain('border-[var(--gold)]');

    const icon = toastCard?.querySelector('.toast-icon-warning');
    expect(icon).toBeInTheDocument();
    expect(icon?.tagName.toLowerCase()).toBe('svg');
  });
});
