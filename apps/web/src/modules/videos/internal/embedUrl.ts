const PROXIED_PROVIDER_DOMAINS = [
  'desustream.net',
  'onenesuhd.com',
  'odstream.net',
];

/**
 * Formats embed URLs for video sources.
 *
 * For videobello.net sources:
 * - Extracts the hash from the URL (e.g., /embed/ZXBpc...)
 * - Returns `/embed/{hash}` to load via the sandbox bootstrap
 *
 * For known problematic provider domains (e.g., desustream.net, onenesuhd.com, odstream.net):
 * - Returns `/api/media/relay?url={encodedUrl}` to bypass CSP frame-ancestors restrictions
 *
 * For other sources (direct URLs):
 * - Returns the URL unchanged for direct video playback
 */
export function formatEmbedUrl(url: string): string {
  if (url.includes('videobello.net')) {
    // Extract hash from videobello.net URLs
    // Expected format: https://videobello.net/embed/ZXBpc...
    const hashMatch = url.match(/\/embed\/([^/?#]+)/);

    if (hashMatch && hashMatch[1]) {
      const hash = hashMatch[1];
      try {
        const parsedUrl = new URL(
          url.startsWith('http') ? url : `https://${url}`
        );
        return `/embed/${hash}${parsedUrl.search}`;
      } catch {
        return `/embed/${hash}`;
      }
    }

    // Fallback to old behavior if hash extraction fails
    return `/api/media/proxy-embed?url=${encodeURIComponent(url)}`;
  }

  const isProxiedProvider = PROXIED_PROVIDER_DOMAINS.some((domain) =>
    url.includes(domain)
  );
  if (isProxiedProvider) {
    return `/api/media/relay?url=${encodeURIComponent(url)}`;
  }

  // Pass through other URLs unchanged (direct sources)
  return url;
}
