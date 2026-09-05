export interface ParsedIngestUrl {
  filename: string;
  quality: string | null;
  label: string;
}

export function parseIngestUrl(urlInput: string): ParsedIngestUrl {
  if (!urlInput || !urlInput.trim()) {
    return {
      filename: '',
      quality: null,
      label: 'S3 Video',
    };
  }

  const trimmed = urlInput.trim();
  let filename = 'video.mp4';
  let fullUrlString = trimmed;

  try {
    const parsed = new URL(trimmed);
    fullUrlString = parsed.toString();
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const rawName = decodeURIComponent(segments[segments.length - 1]);
      if (rawName) {
        filename = rawName;
      }
    }
  } catch {
    const segments = trimmed.split('/').filter(Boolean);
    if (segments.length > 0) {
      filename = segments[segments.length - 1];
    }
  }

  // Infer quality from entire URL string or filename
  let quality: string | null = null;
  const qualityMatch = fullUrlString.match(/(2160p?|4k|1080p?|720p?|480p?|360p?)/i);
  if (qualityMatch) {
    const q = qualityMatch[0].toLowerCase();
    if (q === '4k' || q === '2160' || q === '2160p') quality = '2160p';
    else if (q === '1080' || q === '1080p') quality = '1080p';
    else if (q === '720' || q === '720p') quality = '720p';
    else if (q === '480' || q === '480p') quality = '480p';
    else if (q === '360' || q === '360p') quality = '360p';
  }

  const label = `S3 ${quality || 'Video'}`;

  return {
    filename,
    quality,
    label,
  };
}
