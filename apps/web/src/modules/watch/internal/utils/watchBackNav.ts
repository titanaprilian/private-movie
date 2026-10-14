/**
 * Minimal structural type for the TanStack Router instance used for
 * catalogue back navigation. Only the history surface is required so the
 * helper stays unit-testable without a real router.
 */
export interface BackNavRouter {
  history: {
    canGoBack: () => boolean;
    back: () => void;
  };
}

/**
 * Router-history back navigation: when the router history can go back
 * (the visitor arrived from an in-app catalogue route), go back through
 * history so the catalogue scroll position is restored. Direct external
 * entries with no in-app history fall back to the home route instead of
 * being ejected from the app.
 */
export function navigateBackToCatalog(
  router: BackNavRouter,
  fallback: () => void
): void {
  try {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }
  } catch {
    // fall through to fallback
  }
  fallback();
}
