export const RELAY_EMBED_REFERER = "https://dramula.com";
export const RELAY_CDN_REFERER = "https://videobello.net/";
export const EMBED_UPSTREAM_ORIGIN = "https://videobello.net";
export const EMBED_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * CDN / player host fragments intercepted in-page by the relay interceptor
 * shim and routed through `/api/media/relay`.
 * Requests to these hosts carry the videobello player page as Referer —
 * the CDN allow-lists the player, not dramula.
 */
export const RELAY_CDN_HOST_FRAGMENTS = [
  "skylayer64.online",
  "cloudremux.online",
  "cloudflow",
  "streamflow",
  "medialayer",
  "desustream.net",
  "onenesuhd.com",
  "odstream.net",
];

export function resolveRelayReferer(hostname: string): string {
  const host = hostname.toLowerCase();
  if (host === "videobello.net" || host.endsWith(".videobello.net")) {
    return RELAY_EMBED_REFERER;
  }
  if (RELAY_CDN_HOST_FRAGMENTS.some((fragment) => host.includes(fragment))) {
    return RELAY_CDN_REFERER;
  }
  return RELAY_EMBED_REFERER;
}

/**
 * Hop-by-hop / client-specific headers that must never be forwarded
 * upstream by the reverse proxy or relay. The proxy attaches its own
 * Referer and User-Agent instead.
 */
const UNSAFE_FORWARD_HEADERS = [
  "host",
  "origin",
  "referer",
  "cookie",
  "connection",
  "accept-encoding",
  "user-agent",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
];

export function buildProxyOutboundHeaders(
  request: Request,
  referer: string
): Record<string, string> {
  const outboundHeaders: Record<string, string> = {
    Referer: referer,
  };
  request.headers.forEach((value, key) => {
    if (!UNSAFE_FORWARD_HEADERS.includes(key.toLowerCase())) {
      outboundHeaders[key] = value;
    }
  });
  outboundHeaders["User-Agent"] = EMBED_USER_AGENT;
  return outboundHeaders;
}
