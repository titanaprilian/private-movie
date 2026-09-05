export interface ParsedIngestUrl {
  filename: string;
  quality: string | null;
  label: string;
  detectedEpisodeNumber: number | null;
}

export function detectEpisodeNumber(input: string): number | null {
  if (!input || !input.trim()) return null;

  let target = input.trim();
  try {
    const url = new URL(target);
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      target = decodeURIComponent(segments[segments.length - 1]);
    }
  } catch {
    const segments = target.split('/').filter(Boolean);
    if (segments.length > 0) {
      target = segments[segments.length - 1];
    }
  }

  const nameWithoutExt = target.replace(/\.[a-z0-9]+$/i, '');

  // 1. Check for SxxExx or Exx (e.g. S01E03, E03, E3, e12)
  const eMatch = nameWithoutExt.match(/(?:^|[._ -])(?:S\d+)?E(\d+)(?:[._ -]|$)/i);
  if (eMatch && eMatch[1]) {
    const num = parseInt(eMatch[1], 10);
    if (!isNaN(num)) return num;
  }

  // 2. Check for episode-xx or episode_xx or episode xx (e.g. episode-03, episode3)
  const episodeMatch = nameWithoutExt.match(/(?:^|[._ -])episode[._ -]?(\d+)(?:[._ -]|$)/i);
  if (episodeMatch && episodeMatch[1]) {
    const num = parseInt(episodeMatch[1], 10);
    if (!isNaN(num)) return num;
  }

  // 3. Check for ep-xx or ep_xx or ep.xx or ep xx (e.g. ep2, ep-02, ep.02)
  const epMatch = nameWithoutExt.match(/(?:^|[._ -])ep[._ -]?(\d+)(?:[._ -]|$)/i);
  if (epMatch && epMatch[1]) {
    const num = parseInt(epMatch[1], 10);
    if (!isNaN(num)) return num;
  }

  // 4. Standalone numbers in filename surrounded by delimiters
  const standaloneMatches = Array.from(nameWithoutExt.matchAll(/(?:^|[._ -])(\d{1,3})(?:[._ -]|$)/g));
  for (const match of standaloneMatches) {
    const rawNum = match[1];
    const num = parseInt(rawNum, 10);
    if (num === 2160 || num === 1080 || num === 720 || num === 480 || num === 360 || num === 240) continue;
    if (num >= 1900 && num <= 2099) continue;
    if (!isNaN(num)) return num;
  }

  return null;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const numStr = (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1).replace(/\.0$/, '');
  return `${numStr} ${sizes[i]}`;
}

export function parseIngestUrl(urlInput: string): ParsedIngestUrl {
  if (!urlInput || !urlInput.trim()) {
    return {
      filename: '',
      quality: null,
      label: 'S3 Video',
      detectedEpisodeNumber: null,
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
  const detectedEpisodeNumber = detectEpisodeNumber(trimmed);

  return {
    filename,
    quality,
    label,
    detectedEpisodeNumber,
  };
}
