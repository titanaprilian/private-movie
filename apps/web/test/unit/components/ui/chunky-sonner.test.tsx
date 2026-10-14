import { Toaster } from '@/components/ui/chunky-sonner';
import { renderWithProviders, screen, act } from '../../../utils';
import { describe, expect, it } from 'vitest';
import { toast } from 'sonner';

const CHUNKY_TOAST_CLASSES = [
  'border-2',
  'border-b-4',
  'rounded-2xl',
  'bg-[var(--surface)]',
  'text-[var(--ink)]',
  'font-sans',
  'shadow-xl',
  'p-4',
];

describe('ChunkySonner Toaster component', () => {
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

  it('renders toasts with chunky tactile classes and Baloo/Nunito typography', async () => {
    renderWithProviders(<Toaster />);
    act(() => {
      toast('chunky.base', {
        description: 'chunky base toast body',
      });
    });

    const toastElement = await screen.findByText('chunky.base');
    expect(toastElement).toBeInTheDocument();
    const descriptionElement = screen.getByText('chunky base toast body');
    expect(descriptionElement).toBeInTheDocument();

    const toastCard =
      toastElement.closest('[data-sonner-toast]') || toastElement.closest('li');
    expect(toastCard).toBeInTheDocument();
    for (const cls of CHUNKY_TOAST_CLASSES) {
      expect(toastCard?.className).toContain(cls);
    }

    expect(toastElement.className).toContain('font-display');
    expect(descriptionElement.className).toContain('font-sans');
  });

  it('renders success toast with CheckCircle2 Lucide icon and green border', async () => {
    renderWithProviders(<Toaster />);
    act(() => {
      toast.success('item.create', {
        description: 'item created successfully',
      });
    });

    const toastElement = await screen.findByText('item.create');
    expect(toastElement).toBeInTheDocument();

    const toastCard =
      toastElement.closest('[data-sonner-toast]') || toastElement.closest('li');
    expect(toastCard).toHaveAttribute('data-type', 'success');
    expect(toastCard?.className).toContain('border-[var(--green)]');
    expect(toastCard?.className).toContain('border-b-[var(--green-dark)]');

    const icon = toastCard?.querySelector('.toast-icon-success');
    expect(icon).toBeInTheDocument();
    expect(icon?.tagName.toLowerCase()).toBe('svg');
  });

  it('renders error toast with AlertCircle Lucide icon and red border', async () => {
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
    expect(toastCard?.className).toContain('border-b-[var(--red-dark)]');

    const icon = toastCard?.querySelector('.toast-icon-error');
    expect(icon).toBeInTheDocument();
    expect(icon?.tagName.toLowerCase()).toBe('svg');
  });

  it('renders info toast with Info Lucide icon and blue border', async () => {
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
    expect(toastCard?.className).toContain('border-b-[var(--blue-dark)]');

    const icon = toastCard?.querySelector('.toast-icon-info');
    expect(icon).toBeInTheDocument();
    expect(icon?.tagName.toLowerCase()).toBe('svg');
  });

  it('renders warning toast with AlertTriangle Lucide icon and gold border', async () => {
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
    expect(toastCard?.className).toContain('border-b-[var(--gold-dark)]');

    const icon = toastCard?.querySelector('.toast-icon-warning');
    expect(icon).toBeInTheDocument();
    expect(icon?.tagName.toLowerCase()).toBe('svg');
  });
});
