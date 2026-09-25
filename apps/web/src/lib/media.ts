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
 * Restrictive sandbox policy for BelloCloud/videobello embed iframes.
 * Strictly omits `allow-popups` and `allow-top-navigation` so browsers
 * natively block tab-opening and app-switching attempts from ad scripts.
 */
export const BELLOCLOUD_IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-presentation';

const BELLOCLOUD_PROVIDER_KEYWORDS = [
  'videobello.net',
  'bellocloud',
];

/**
 * Returns true when a video source URL belongs to the BelloCloud/videobello
 * embed provider. Only these iframes get the restrictive sandbox attribute;
 * other providers (Vidhide, Filedon, …) run sandbox detection scripts that
 * break when sandboxed, so they must remain un-sandboxed.
 */
export function isBelloCloudEmbedUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return BELLOCLOUD_PROVIDER_KEYWORDS.some((keyword) =>
    lower.includes(keyword)
  );
}

/**
 * Returns the sandbox attribute value for an embed iframe, or `undefined`
 * when the provider must remain un-sandboxed. Passing `undefined` to React's
 * `sandbox` prop omits the attribute entirely.
 */
export function getEmbedIframeSandbox(sourceUrl: string): string | undefined {
  return isBelloCloudEmbedUrl(sourceUrl)
    ? BELLOCLOUD_IFRAME_SANDBOX
    : undefined;
}

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
