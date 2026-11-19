import { vi } from 'vitest';

/**
 * Standard no-op function for non-asserted event handlers and callbacks,
 * avoiding unnecessary vi.fn() allocations.
 */
export const noop = () => {};

/**
 * Consolidates JSDOM HTMLMediaElement prototype mocks.
 */
export function setupMediaElementPolyfills() {
  if (typeof window !== 'undefined' && window.HTMLMediaElement) {
    window.HTMLMediaElement.prototype.play = vi
      .fn()
      .mockImplementation(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = vi
      .fn()
      .mockImplementation(() => {});
    window.HTMLMediaElement.prototype.load = vi
      .fn()
      .mockImplementation(() => {});
  }
}
