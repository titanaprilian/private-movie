export interface InferredSourceMetadata {
  label: string;
  quality: string | null;
}

const QUALITY_RESOLUTIONS = [
  '2160p',
  '1440p',
  '1080p',
  '720p',
  '480p',
  '360p',
] as const;

export function inferQualityFromUrl(url: string): string | null {
  if (!url || !url.trim()) return null;

  const trimmed = url.trim();

  // 1. Explicit resolution with 'p' suffix (e.g. 720p, 1080p, 480p, 360p, 1440p, 2160p)
  const pMatch =
    trimmed.match(
      /(?:^|[^a-zA-Z0-9])(2160p|1440p|1080p|720p|480p|360p)(?:$|[^a-zA-Z0-9])/i
    ) ?? trimmed.match(/(\d{3,4}p)/i);

  if (pMatch && pMatch[1]) {
    const q = pMatch[1].toLowerCase();
    if ((QUALITY_RESOLUTIONS as readonly string[]).includes(q)) {
      return q;
    }
  }

  // 2. 4K
  if (/(?:^|[^a-zA-Z0-9])4k(?:$|[^a-zA-Z0-9])/i.test(trimmed)) {
    return '2160p';
  }

  // 3. Delimited resolution numbers without 'p' (e.g. _720_, .1080.)
  const numMatch = trimmed.match(
    /(?:^|[._ -])(2160|1440|1080|720|480|360)(?:[._ -]|$)/
  );
  if (numMatch && numMatch[1]) {
    return `${numMatch[1]}p`;
  }

  return null;
}

export function inferLabelFromUrl(url: string): string {
  if (!url || !url.trim()) return '';

  const trimmed = url.trim();
  let segment = '';

  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      segment = segments[segments.length - 1];
    }
  } catch {
    const segments = trimmed.split('/').filter(Boolean);
    if (segments.length > 0) {
      segment = segments[segments.length - 1];
    }
  }

  if (!segment) return '';

  try {
    segment = decodeURIComponent(segment);
  } catch {
    // keep raw segment
  }

  // Strip query/hash if present in segment (e.g. if fallback parsing was used)
  segment = segment.split('?')[0].split('#')[0];

  // Strip common video extensions
  const clean = segment
    .replace(/\.(mp4|mkv|webm|avi|mov|m4v|ts|flv|m3u8)$/i, '')
    .trim();

  return clean;
}

export function inferSourceMetadata(url: string): InferredSourceMetadata {
  return {
    label: inferLabelFromUrl(url),
    quality: inferQualityFromUrl(url),
  };
}
