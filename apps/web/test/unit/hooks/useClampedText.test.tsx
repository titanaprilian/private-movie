import * as React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '../../utils';
import { useClampedText } from '@/hooks/useClampedText';

const roCallbacks = new Set<ResizeObserverCallback>();

function triggerResize() {
  act(() => {
    roCallbacks.forEach((cb) => cb([], {} as ResizeObserver));
  });
}

function setGeometry(
  el: HTMLElement,
  dims: { clientHeight: number; scrollHeight: number }
) {
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    get: () => dims.clientHeight,
  });
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => dims.scrollHeight,
  });
}

function Harness({
  text,
  seriesId,
  seasonId,
}: {
  text: string;
  seriesId?: string;
  seasonId?: string;
}) {
  const {
    contentRef,
    showToggle,
    toggleExpanded,
    toggleLabel,
    toggleProps,
    isTruncated,
    isExpanded,
  } = useClampedText(text, { seriesId, seasonId, contentId: 'series-desc' });
  return (
    <div>
      <p
        id="series-desc"
        ref={contentRef as React.Ref<HTMLParagraphElement>}
        data-testid="desc"
        data-truncated={String(isTruncated)}
        data-expanded={String(isExpanded)}
      >
        {text}
      </p>
      {showToggle && <button onClick={toggleExpanded} {...toggleProps}>{toggleLabel}</button>}
    </div>
  );
}

describe('useClampedText', () => {
  beforeEach(() => {
    roCallbacks.clear();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: ResizeObserverCallback) {
          roCallbacks.add(cb);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders non-truncated text without a toggle button', () => {
    render(<Harness text="Short description." />);
    const desc = screen.getByTestId('desc');
    setGeometry(desc, { clientHeight: 42, scrollHeight: 42 });
    triggerResize();
    expect(desc).toHaveAttribute('data-truncated', 'false');
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
  });

  it('detects truncation via scrollHeight > clientHeight + 1 and shows a toggle', () => {
    render(<Harness text={'Long description. '.repeat(50)} />);
    const desc = screen.getByTestId('desc');
    setGeometry(desc, { clientHeight: 42, scrollHeight: 120 });
    triggerResize();
    expect(desc).toHaveAttribute('data-truncated', 'true');
    expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
  });

  it('ignores a 1px rounding difference (no truncation)', () => {
    render(<Harness text="Borderline text." />);
    const desc = screen.getByTestId('desc');
    setGeometry(desc, { clientHeight: 42, scrollHeight: 43 });
    triggerResize();
    expect(desc).toHaveAttribute('data-truncated', 'false');
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
  });

  it('toggles aria-expanded and the label between Show more and Show less', () => {
    render(<Harness text={'Long description. '.repeat(50)} />);
    const desc = screen.getByTestId('desc');
    setGeometry(desc, { clientHeight: 42, scrollHeight: 120 });
    triggerResize();

    const toggle = screen.getByRole('button', { name: 'Show more' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'series-desc');

    fireEvent.click(toggle);
    expect(desc).toHaveAttribute('data-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(desc).toHaveAttribute('data-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
  });

  it('bypasses truncation re-measurement while expanded', () => {
    render(<Harness text={'Long description. '.repeat(50)} />);
    const desc = screen.getByTestId('desc');
    setGeometry(desc, { clientHeight: 42, scrollHeight: 120 });
    triggerResize();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(desc).toHaveAttribute('data-expanded', 'true');

    // Geometry now reports unclamped, but the expanded state must win.
    setGeometry(desc, { clientHeight: 200, scrollHeight: 120 });
    triggerResize();
    expect(desc).toHaveAttribute('data-expanded', 'true');
    expect(desc).toHaveAttribute('data-truncated', 'true');
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });

  it('resets to collapsed when the text content changes', () => {
    const { rerender } = render(<Harness text={'Long description. '.repeat(50)} />);
    const desc = screen.getByTestId('desc');
    setGeometry(desc, { clientHeight: 42, scrollHeight: 120 });
    triggerResize();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(desc).toHaveAttribute('data-expanded', 'true');

    rerender(<Harness text={'A totally different long description. '.repeat(50)} />);
    expect(screen.getByTestId('desc')).toHaveAttribute('data-expanded', 'false');
  });

  it('resets to collapsed when the series ID or season ID changes', () => {
    const { rerender } = render(
      <Harness text={'Long description. '.repeat(50)} seriesId="s1" seasonId="season-1" />
    );
    const desc = screen.getByTestId('desc');
    setGeometry(desc, { clientHeight: 42, scrollHeight: 120 });
    triggerResize();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(desc).toHaveAttribute('data-expanded', 'true');

    rerender(
      <Harness text={'Long description. '.repeat(50)} seriesId="s2" seasonId="season-1" />
    );
    expect(screen.getByTestId('desc')).toHaveAttribute('data-expanded', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    rerender(
      <Harness text={'Long description. '.repeat(50)} seriesId="s2" seasonId="season-2" />
    );
    expect(screen.getByTestId('desc')).toHaveAttribute('data-expanded', 'false');
  });

  it('re-measures truncation when the text changes', () => {
    const { rerender } = render(<Harness text={'Long description. '.repeat(50)} />);
    const desc = screen.getByTestId('desc');
    setGeometry(desc, { clientHeight: 42, scrollHeight: 120 });
    triggerResize();
    expect(desc).toHaveAttribute('data-truncated', 'true');

    rerender(<Harness text="Short." />);
    const updated = screen.getByTestId('desc');
    setGeometry(updated, { clientHeight: 42, scrollHeight: 21 });
    triggerResize();
    expect(updated).toHaveAttribute('data-truncated', 'false');
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
  });
});
