import type { S3StorageService } from "../s3/s3-storage-service";

export interface NormalizationOptions {
  s3StorageService?: S3StorageService;
  expiresInSeconds?: number;
}

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

export async function normalizeVideoSourceAsync<T extends { url: string; type?: string }>(
  source: T,
  options?: NormalizationOptions
): Promise<T> {
  let url = source.url;

  if (source.type === "s3" && options?.s3StorageService) {
    // Only sign if it's not already a signed or full http(s) URL
    const isFullUrl = url.startsWith("http://") || url.startsWith("https://");
    if (!isFullUrl && options.s3StorageService.isConfigured()) {
      try {
        const signedUrl = await options.s3StorageService.getPresignedPlaybackUrl(
          url,
          options.expiresInSeconds ?? 21600
        );
        url = signedUrl;
      } catch {
        // Fall back gracefully to original url if presigning fails
      }
    }
  } else {
    url = normalizePlaybackUrl(url);
  }

  if (url === source.url) {
    return source;
  }
  return {
    ...source,
    url,
  };
}

export function normalizeVideoSourceSync<T extends { url: string; type?: string }>(
  source: T,
  options?: NormalizationOptions
): T {
  const normalizedUrl = normalizePlaybackUrl(source.url);
  if (normalizedUrl === source.url) {
    return source;
  }
  return {
    ...source,
    url: normalizedUrl,
  };
}

export function normalizeVideoSourcesSync<T extends { url: string; type?: string }>(
  sources: T[],
  options?: NormalizationOptions
): T[] {
  return sources.map((s) => normalizeVideoSourceSync(s, options));
}

export const normalizeVideoSource = normalizeVideoSourceAsync;

export async function normalizeVideoSources<T extends { url: string; type?: string }>(
  sources: T[],
  options?: NormalizationOptions
): Promise<T[]> {
  if (options?.s3StorageService) {
    return Promise.all(sources.map((s) => normalizeVideoSourceAsync(s, options)));
  }
  return sources.map((s) => normalizeVideoSourceSync(s, options));
}


