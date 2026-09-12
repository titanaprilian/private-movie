import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdblockDetector } from '@/modules/watch/internal/useAdblockDetector';

describe('useAdblockDetector', () => {
  const originalFetch = window.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.fetch = originalFetch;
  });

  it('returns false when neither network nor DOM probe detects adblock', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response(''));

    const { result } = renderHook(() => useAdblockDetector());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isBlocked).toBe(false);
  });

  it('detects adblock when network bait fetch is rejected or blocked', async () => {
    vi.spyOn(window, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useAdblockDetector());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isBlocked).toBe(true);
  });

  it('detects adblock when DOM bait element is hidden/collapsed by adblocker', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response(''));

    // Mock DOM bait being hidden via computed style
    const originalGetComputedStyle = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((elt) => {
      if (elt instanceof HTMLElement && elt.className.includes('adsbox')) {
        return { display: 'none', visibility: 'hidden' } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(elt);
    });

    const { result } = renderHook(() => useAdblockDetector());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isBlocked).toBe(true);
  });
});
