export function formatEmbedUrl(url: string): string {
  if (url.includes('videobello.net')) {
    return `/api/media/proxy-embed?url=${encodeURIComponent(url)}`;
  }
  return url;
}
