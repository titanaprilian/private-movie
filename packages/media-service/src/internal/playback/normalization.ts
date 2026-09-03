export function normalizePlaybackUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("/embed/") || url.startsWith("/api/media/proxy-embed")) {
    return url;
  }
  if (url.includes("videobello.net")) {
    const hashMatch = url.match(/\/embed\/([^/?#]+)/);
    if (hashMatch && hashMatch[1]) {
      const hash = hashMatch[1];
      try {
        const parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
        return `/embed/${hash}${parsedUrl.search}`;
      } catch {
        return `/embed/${hash}`;
      }
    }
    return `/api/media/proxy-embed?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function normalizeVideoSource<T extends { url: string }>(source: T): T {
  const normalizedUrl = normalizePlaybackUrl(source.url);
  if (normalizedUrl === source.url) {
    return source;
  }
  return {
    ...source,
    url: normalizedUrl,
  };
}

export function normalizeVideoSources<T extends { url: string }>(sources: T[]): T[] {
  return sources.map(normalizeVideoSource);
}
