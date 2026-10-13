/**
 * Returns true when `document.referrer` belongs to the current origin,
 * meaning the visitor arrived from an internal catalogue route
 * (Home, Genres, Search) and history-back is safe.
 */
export function isInternalReferrer(): boolean {
  try {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return false;
    }
    const referrer = document.referrer;
    if (!referrer) return false;
    return new URL(referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Referrer-safe catalog back navigation: internal visitors go back through
 * browser history (preserving catalogue scroll position), while direct
 * external visitors fall back to the home route.
 */
export function navigateBackToCatalog(fallback: () => void): void {
  if (isInternalReferrer()) {
    try {
      window.history.back();
      return;
    } catch {
      // fall through to fallback
    }
  }
  fallback();
}
