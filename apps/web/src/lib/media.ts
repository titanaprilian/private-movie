const PROXIED_PROVIDER_DOMAINS = [
  'onenesuhd.com',
];

const PATH_PROXIED_PROVIDER_DOMAINS = [
  'desustream.net',
  'odstream.net',
];

const AD_SUPPRESSED_PROVIDER_KEYWORDS = [
  'vidhide',
  'filedon',
];

/**
 * Formats embed URLs for video sources.
 *
 * For videobello.net sources:
 * - Extracts the hash from the URL (e.g., /embed/ZXBpc...)
 * - Returns `/embed/{hash}` to load via the sandbox bootstrap
 *
 * For known popup/ad-heavy provider domains (e.g., vidhide, filedon and their mirrors)
 * and path-proxied embed providers (e.g., desustream.net, odstream.net):
 * - Returns `/api/media/proxy/:domain/*` for path-based reverse proxying with ad suppression
 *
 * For known problematic provider domains (e.g., onenesuhd.com):
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

    // Fallback to old proxy behavior if hash extraction fails
    return `/api/media/proxy-embed?url=${encodeURIComponent(url)}`;
  }

  const lowerUrl = url.toLowerCase();
  const isAdSuppressedProvider = AD_SUPPRESSED_PROVIDER_KEYWORDS.some((keyword) =>
    lowerUrl.includes(keyword)
  );
  const isPathProxiedProvider = PATH_PROXIED_PROVIDER_DOMAINS.some((domain) =>
    lowerUrl.includes(domain)
  );
  if (isAdSuppressedProvider || isPathProxiedProvider) {
    try {
      const parsedUrl = new URL(
        url.startsWith('http://') || url.startsWith('https://')
          ? url
          : `https://${url}`
      );
      const pathWithLeadingSlash = parsedUrl.pathname.startsWith('/')
        ? parsedUrl.pathname
        : `/${parsedUrl.pathname}`;
      return `/api/media/proxy/${parsedUrl.host}${pathWithLeadingSlash}${parsedUrl.search}`;
    } catch {
      return `/api/media/proxy-embed?url=${encodeURIComponent(url)}`;
    }
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
