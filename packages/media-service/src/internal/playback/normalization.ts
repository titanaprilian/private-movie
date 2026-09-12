import type { S3StorageService } from "../s3/s3-storage-service";
import type { StorageProviderRegistry } from "../s3/registry";

export interface NormalizationOptions {
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
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

export async function normalizeVideoSourceAsync<
  T extends { url: string; type?: string; storageProviderId?: string | null },
>(
  source: T,
  options?: NormalizationOptions
): Promise<T> {
  let url = source.url;

  if (source.type === "s3") {
    // Determine the service to use: either from registry or options.s3StorageService
    let service: S3StorageService | undefined = options?.s3StorageService;
    if (options?.storageProviderRegistry) {
      const registryService = await options.storageProviderRegistry.getService(
        source.storageProviderId
      );
      if (registryService) {
        service = registryService;
      }
    }

    if (service && service.isConfigured()) {
      const publicBase = typeof service.getPublicBaseUrl === "function" ? service.getPublicBaseUrl() : null;
      const isFullUrl = url.startsWith("http://") || url.startsWith("https://");

      if (publicBase) {
        // Direct CDN playback URL formatting
        const cleanKey = url.replace(/^\/+/, "");
        url = `${publicBase}/${cleanKey}`;
      } else if (!isFullUrl) {
        // Presigned GET URL
        try {
          const signedUrl = await service.getPresignedPlaybackUrl(
            url,
            options?.expiresInSeconds ?? 21600
          );
          url = signedUrl;
        } catch {
          // Fall back gracefully to original url if presigning fails
        }
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

export async function normalizeVideoSources<
  T extends { url: string; type?: string; storageProviderId?: string | null },
>(
  sources: T[],
  options?: NormalizationOptions
): Promise<T[]> {
  if (options?.s3StorageService || options?.storageProviderRegistry) {
    return Promise.all(sources.map((s) => normalizeVideoSourceAsync(s, options)));
  }
  return sources.map((s) => normalizeVideoSourceSync(s, options));
}



