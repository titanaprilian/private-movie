import * as cheerio from "cheerio";

export class MissingEmbedUrlError extends Error {
  constructor(message = "Episode has no embed URL") {
    super(message);
    this.name = "MissingEmbedUrlError";
  }
}

export class StreamNotFoundError extends Error {
  constructor(message = "No video stream found on page") {
    super(message);
    this.name = "StreamNotFoundError";
  }
}

export function extractVideoStream(html: string): string | null {
  if (!html || !html.trim()) {
    return null;
  }

  const $ = cheerio.load(html);

  // Check <video src="...">
  const videoSrc = $("video").attr("src");
  if (videoSrc && videoSrc.trim()) {
    return videoSrc.trim();
  }

  // Check <video><source src="..."></video> or standalone <source src="...">
  let sourceSrc: string | undefined;
  $("source").each((_, el) => {
    const src = $(el).attr("src");
    if (src && src.trim() && !sourceSrc) {
      sourceSrc = src.trim();
    }
  });

  if (sourceSrc) {
    return sourceSrc;
  }

  // Regex fallback for raw .mp4 or .m3u8 URLs in inline JS / HTML attributes
  const match = html.match(/https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8)(?:[^\s"'<>]*)/i);
  if (match && match[0]) {
    return match[0];
  }

  return null;
}
