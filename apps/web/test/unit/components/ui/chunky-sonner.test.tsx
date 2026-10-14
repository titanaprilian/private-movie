import { Toaster } from '@/components/ui/chunky-sonner';
import { renderWithProviders, screen, act } from '../../../utils';
import { describe, expect, it } from 'vitest';
import { toast } from 'sonner';

const CHUNKY_TOAST_CLASSES = [
  'border-2',
  'border-b-4',
  '!rounded-2xl',
  'bg-[var(--surface)]',
  'text-[var(--ink)]',
  'font-sans',
  'shadow-xl',
  'hover:-translate-y-[2px]',
  'hover:shadow-2xl',
  'cursor-pointer',
  'transition-all',
  'duration-150',
  'p-4',
];

const ICON_BADGE_CLASSES = [
  'rounded-xl',
  '!size-9',
  'shadow-sm',
  'mr-3.5',
  'shrink-0',
  'flex',
  'items-center',
  'justify-center',
  '!items-center',
  '!justify-center',
  '[&_svg]:!m-auto',
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

  it('applies an explicit 16px border-radius override to toast options style', async () => {
    renderWithProviders(<Toaster />);
    act(() => {
      toast('radius.check', { description: 'radius override body' });
    });

    const toastElement = await screen.findByText('radius.check');
    const toastCard =
      toastElement.closest('[data-sonner-toast]') || toastElement.closest('li');
    expect(toastCard).toBeInTheDocument();
    expect(
      (toastCard as HTMLElement).style.getPropertyValue('--border-radius'),
    ).toBe('16px');
  });

  it('bridges theme tokens into Sonner CSS variables via toast options style', async () => {
    renderWithProviders(<Toaster />);
    act(() => {
      toast('theme.tokens', { description: 'theme token body' });
    });

    const toastElement = await screen.findByText('theme.tokens');
    const toastCard =
      toastElement.closest('[data-sonner-toast]') || toastElement.closest('li');
    expect(toastCard).toBeInTheDocument();
    expect(
      (toastCard as HTMLElement).style.getPropertyValue('--normal-bg'),
    ).toBe('var(--surface)');
    expect(
      (toastCard as HTMLElement).style.getPropertyValue('--normal-text'),
    ).toBe('var(--ink)');
    expect(
      (toastCard as HTMLElement).style.getPropertyValue('--normal-border'),
    ).toBe('var(--border)');
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
    expect(toastElement.className).toContain('font-extrabold');
    expect(toastElement.className).toContain('text-sm');
    expect(toastElement.className).toContain('tracking-wide');
    expect(descriptionElement.className).toContain('font-sans');
    expect(descriptionElement.className).toContain('font-bold');
    expect(descriptionElement.className).toContain('text-xs');
    expect(descriptionElement.className).toContain('leading-relaxed');
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
    expect(toastCard?.className).toContain('!bg-[var(--green-soft)]');
    expect(toastCard?.className).toContain('!border-[var(--green)]');
    expect(toastCard?.className).toContain('!border-b-[var(--green-dark)]');

    const icon = toastCard?.querySelector('.toast-icon-success');
    expect(icon).toBeInTheDocument();
    expect(icon?.tagName.toLowerCase()).toBe('svg');
    const badge = icon?.closest('[data-icon]');
    expect(badge).toBeInTheDocument();
    for (const cls of ICON_BADGE_CLASSES) {
      expect(badge?.className).toContain(cls);
    }
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
    expect(toastCard?.className).toContain('!bg-[var(--red-soft)]');
    expect(toastCard?.className).toContain('!border-[var(--red)]');
    expect(toastCard?.className).toContain('!border-b-[var(--red-dark)]');

    const icon = toastCard?.querySelector('.toast-icon-error');
    expect(icon).toBeInTheDocument();
    expect(icon?.tagName.toLowerCase()).toBe('svg');
    const badge = icon?.closest('[data-icon]');
    expect(badge).toBeInTheDocument();
    for (const cls of ICON_BADGE_CLASSES) {
      expect(badge?.className).toContain(cls);
    }
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
    expect(toastCard?.className).toContain('!bg-[var(--blue-soft)]');
    expect(toastCard?.className).toContain('!border-[var(--blue)]');
    expect(toastCard?.className).toContain('!border-b-[var(--blue-dark)]');

    const icon = toastCard?.querySelector('.toast-icon-info');
    expect(icon).toBeInTheDocument();
    expect(icon?.tagName.toLowerCase()).toBe('svg');
    const badge = icon?.closest('[data-icon]');
    expect(badge).toBeInTheDocument();
    for (const cls of ICON_BADGE_CLASSES) {
      expect(badge?.className).toContain(cls);
    }
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
    expect(toastCard?.className).toContain('!bg-[var(--gold-soft)]');
    expect(toastCard?.className).toContain('!border-[var(--gold)]');
    expect(toastCard?.className).toContain('!border-b-[var(--gold-dark)]');

    const icon = toastCard?.querySelector('.toast-icon-warning');
    expect(icon).toBeInTheDocument();
    expect(icon?.tagName.toLowerCase()).toBe('svg');
    const badge = icon?.closest('[data-icon]');
    expect(badge).toBeInTheDocument();
    for (const cls of ICON_BADGE_CLASSES) {
      expect(badge?.className).toContain(cls);
    }
  });

  it('defines solid opaque hex soft surface tokens in light and dark mode (no alpha transparency)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const cssPath = path.resolve(__dirname, '../../../../src/index.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    const rootBlock = css.match(/:root\s*{([^}]*)}/)?.[1] ?? '';
    const darkBlock = css.match(/\.dark\s*{([^}]*)}/)?.[1] ?? '';
    expect(rootBlock).toBeTruthy();
    expect(darkBlock).toBeTruthy();
    const tokens = ['--green-soft', '--red-soft', '--blue-soft', '--gold-soft'];
    const opaqueHex = /^#[0-9a-fA-F]{6}$/;
    for (const token of tokens) {
      const rootValue = rootBlock.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]?.trim();
      const darkValue = darkBlock.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]?.trim();
      expect(rootValue, `${token} light mode value`).toMatch(opaqueHex);
      expect(darkValue, `${token} dark mode value`).toMatch(opaqueHex);
      expect(rootValue).not.toMatch(/rgba?\(/);
      expect(darkValue).not.toMatch(/rgba?\(/);
    }
  });
});
