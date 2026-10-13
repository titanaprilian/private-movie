import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StarToggleButton } from '@/modules/videos';
import { renderWithProviders, screen, fireEvent } from '../../utils';

describe('StarToggleButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders inactive state with accessible label and Star outline', async () => {
    const onToggle = vi.fn();
    const { user } = renderWithProviders(
      <StarToggleButton
        active={false}
        onToggle={onToggle}
        activeLabel="Remove Dune from featured"
        inactiveLabel="Mark Dune as featured"
      />
    );
    const btn = screen.getByRole('button', { name: 'Mark Dune as featured' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn.className).toContain('opacity-0');
    const star = btn.querySelector('svg');
    expect(star).toBeInTheDocument();
    expect(star).toHaveAttribute('fill', 'none');
    expect(star).toHaveAttribute('aria-hidden', 'true');

    await user.hover(btn);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Mark as featured'
    );
  });

  it('renders active state with filled Star and gold styling', async () => {
    const onToggle = vi.fn();
    const { user } = renderWithProviders(
      <StarToggleButton
        active
        onToggle={onToggle}
        activeLabel="Remove Dune from featured"
        inactiveLabel="Mark Dune as featured"
      />
    );
    const btn = screen.getByRole('button', { name: 'Remove Dune from featured' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn.className).toContain('bg-[var(--gold-tint)]');
    expect(btn.className).toContain('opacity-100');
    const star = btn.querySelector('svg');
    expect(star).toHaveAttribute('fill', 'currentColor');

    await user.hover(btn);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Remove from featured'
    );
  });

  it('calls onToggle on click without bubbling to parent handlers', async () => {
    const onToggle = vi.fn();
    const parentClick = vi.fn();
    const { user } = renderWithProviders(
      <div onClick={parentClick}>
        <StarToggleButton active={false} onToggle={onToggle} />
      </div>
    );
    const btn = screen.getByRole('button', { name: 'Mark as featured' });
    await user.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('also toggles via fireEvent click', () => {
    const onToggle = vi.fn();
    renderWithProviders(<StarToggleButton active onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove from featured' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('supports custom tooltip texts', async () => {
    const { user } = renderWithProviders(
      <StarToggleButton
        active={false}
        onToggle={vi.fn()}
        inactiveTooltip="Pin to top"
        activeTooltip="Unpin"
      />
    );
    const btn = screen.getByRole('button', { name: 'Mark as featured' });
    await user.hover(btn);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Pin to top');
  });

  it('respects an explicit aria-label override', () => {
    renderWithProviders(
      <StarToggleButton
        active={false}
        onToggle={vi.fn()}
        aria-label="Custom star label"
      />
    );
    expect(
      screen.getByRole('button', { name: 'Custom star label' })
    ).toBeInTheDocument();
  });
});
