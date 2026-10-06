export const GOOGLE_DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;
export const GOOGLE_DRIVE_DIRECT_DOWNLOAD_BASE = "https://drive.usercontent.google.com/download";

const GOOGLE_DRIVE_HOSTNAMES = new Set([
  "drive.google.com",
  "docs.google.com",
  "drive.usercontent.google.com",
]);

export interface GoogleDriveFileRef {
  fileId: string;
  downloadUrl: string;
}

export interface GoogleDriveConfirmForm {
  action: string;
  fields: Record<string, string>;
}

export interface GoogleDriveConfirmRequest {
  url: string;
  headers: Record<string, string>;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function readAttributes(fragment: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(fragment)) !== null) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? "");
  }
  return attributes;
}

/**
 * Parses public Google Drive share links into the canonical direct-download
 * URL, and resolves the large-file virus-scan interstitial that Drive serves
 * instead of the archive bytes.
 *
 * Google answers a direct-download request for a large file with an HTML
 * confirmation page carrying a hidden form. Posting that form's action with
 * its hidden fields (and replaying the cookies set on the interstitial
 * response) yields the real bytes.
 */
export class GoogleDriveUrlHelper {
  static isFileId(value: string): boolean {
    return GOOGLE_DRIVE_FILE_ID_PATTERN.test(value.trim());
  }

  static isGoogleDriveUrl(rawUrl: string): boolean {
    try {
      return GOOGLE_DRIVE_HOSTNAMES.has(new URL(rawUrl).hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  static extractFileId(rawUrl: string): string | null {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return null;
    }
    if (!GOOGLE_DRIVE_HOSTNAMES.has(url.hostname.toLowerCase())) return null;

    const pathMatch = /^\/(?:file|document|spreadsheets)\/d\/([^/]+)/.exec(url.pathname);
    const candidate = pathMatch?.[1] ?? url.searchParams.get("id");
    if (!candidate || !GoogleDriveUrlHelper.isFileId(candidate)) return null;
    return candidate;
  }

  static buildDirectDownloadUrl(fileId: string): string {
    return `${GOOGLE_DRIVE_DIRECT_DOWNLOAD_BASE}?id=${encodeURIComponent(fileId)}&export=download`;
  }

  static parseSource(rawUrl: string): GoogleDriveFileRef | null {
    const fileId = GoogleDriveUrlHelper.extractFileId(rawUrl);
    if (!fileId) return null;
    return { fileId, downloadUrl: GoogleDriveUrlHelper.buildDirectDownloadUrl(fileId) };
  }

  static isInterstitial(response: { headers: Headers; status: number }): boolean {
    if (response.status < 200 || response.status >= 400) return false;
    return /text\/html/i.test(response.headers.get("content-type") ?? "");
  }

  static extractConfirmForm(html: string): GoogleDriveConfirmForm | null {
    const formPattern = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
    let match: RegExpExecArray | null;
    while ((match = formPattern.exec(html)) !== null) {
      const action = readAttributes(match[1]).action;
      if (!action) continue;
      const fields: Record<string, string> = {};
      const inputPattern = /<input\b([^>]*)>/gi;
      let inputMatch: RegExpExecArray | null;
      while ((inputMatch = inputPattern.exec(match[2])) !== null) {
        const attributes = readAttributes(inputMatch[1]);
        if (attributes.name) fields[attributes.name] = attributes.value ?? "";
      }
      return { action, fields };
    }
    return null;
  }

  static collectCookies(headers: Headers): string {
    const raw = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
    const cookies = raw.length
      ? raw
      : (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);
    return cookies
      .map((cookie) => cookie.split(";")[0]?.trim() ?? "")
      .filter(Boolean)
      .join("; ");
  }

  static buildConfirmRequest(
    form: GoogleDriveConfirmForm,
    cookie?: string
  ): GoogleDriveConfirmRequest {
    let action: URL;
    try {
      action = new URL(form.action);
    } catch {
      action = new URL(GOOGLE_DRIVE_DIRECT_DOWNLOAD_BASE);
    }
    for (const [name, value] of Object.entries(form.fields)) {
      action.searchParams.set(name, value);
    }
    if (GOOGLE_DRIVE_HOSTNAMES.has(action.hostname.toLowerCase()) && !action.searchParams.has("confirm")) {
      action.searchParams.set("confirm", "t");
    }
    const headers: Record<string, string> = {};
    if (cookie) headers.Cookie = cookie;
    return { url: action.toString(), headers };
  }
}