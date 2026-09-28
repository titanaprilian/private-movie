import * as React from 'react';

export interface UseClampedTextOptions {
  /** Series identifier — expanded state resets when it changes. */
  seriesId?: string;
  /** Active season identifier — expanded state resets when it changes. */
  seasonId?: string;
  /** ID of the measured description element, used for `aria-controls` bindings. */
  contentId?: string;
}

export interface UseClampedTextResult {
  /** Attach to the measured, clamped description element. */
  contentRef: React.RefObject<HTMLElement | null>;
  /** True when the text is actually truncated by the 2-line clamp. */
  isTruncated: boolean;
  /** True when the user expanded the full description. */
  isExpanded: boolean;
  /** Toggle between expanded and collapsed. */
  toggleExpanded: () => void;
  /** Label for the toggle button. */
  toggleLabel: 'Show more' | 'Show less';
  /** Whether the "Show more / Show less" toggle should be rendered. */
  showToggle: boolean;
  /** Spread onto the toggle button for `aria-expanded` / `aria-controls`. */
  toggleProps: {
    'aria-expanded': boolean;
    'aria-controls'?: string;
  };
}

function isElementTruncated(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight + 1;
}

export function useClampedText(
  text: string,
  options?: UseClampedTextOptions
): UseClampedTextResult {
  const { seriesId, seasonId, contentId } = options ?? {};
  const contentRef = React.useRef<HTMLElement | null>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const isExpandedRef = React.useRef(false);
  isExpandedRef.current = isExpanded;

  // Reset to collapsed whenever the content identity changes.
  React.useEffect(() => {
    setIsExpanded(false);
  }, [text, seriesId, seasonId]);

  // Measure true truncation via DOM geometry. Skipped while expanded —
  // the container is fully open, so geometry no longer reflects clamping.
  React.useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const measure = () => {
      if (isExpandedRef.current) return;
      setIsTruncated(isElementTruncated(el));
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, seriesId, seasonId]);

  const toggleExpanded = React.useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const showToggle = isTruncated || isExpanded;

  return {
    contentRef,
    isTruncated,
    isExpanded,
    toggleExpanded,
    toggleLabel: isExpanded ? 'Show less' : 'Show more',
    showToggle,
    toggleProps: {
      'aria-expanded': isExpanded,
      ...(contentId ? { 'aria-controls': contentId } : {}),
    },
  };
}
