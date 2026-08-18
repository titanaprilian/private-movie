import { MirrorResolveError } from "../../errors";
import type { FetchFn } from "../../types";
import type { ParsedMirrorPayload } from "./parse";

export type ResolvedMirror = { url: string; label: string };

const AJAX_BASE_URL = "https://otakudesu.blog/wp-admin/admin-ajax.php";

export interface ResolveInput {
  payloads: ParsedMirrorPayload[];
  fetchFn: FetchFn;
  ajaxUrl?: string;
  nonceAction: string;
  mirrorAction: string;
}

export async function resolveMirrors({
  payloads,
  fetchFn,
  ajaxUrl = AJAX_BASE_URL,
  nonceAction,
  mirrorAction,
}: ResolveInput): Promise<ResolvedMirror[]> {
  if (payloads.length === 0) {
    return [];
  }

  let nonce: string;
  try {
    const nonceBody = new URLSearchParams({ action: nonceAction }).toString();
    const nonceRaw = await fetchFn.post(ajaxUrl, nonceBody);
    const nonceJson = JSON.parse(nonceRaw);
    nonce = (nonceJson as { data: string }).data;

    if (!nonce) {
      throw new MirrorResolveError("failed to fetch nonce");
    }
  } catch (error) {
    throw new MirrorResolveError(
      "failed to fetch nonce",
      error instanceof Error ? error : undefined
    );
  }

  const results: ResolvedMirror[] = [];

  for (const payload of payloads) {
    try {
      const body = new URLSearchParams();
      body.set("id", String(payload.id));
      body.set("i", String(payload.i));
      body.set("q", payload.q);
      body.set("nonce", nonce);
      body.set("action", mirrorAction);

      const responseRaw = await fetchFn.post(ajaxUrl, body.toString());
      const responseJson = JSON.parse(responseRaw);
      const base64Html = (responseJson as { data: string }).data;
      const iframeUrl = extractIframeSrc(base64Html);

      if (!iframeUrl) {
        console.error(`No iframe found in mirror response for ${payload.label}`);
        continue;
      }

      results.push({ url: iframeUrl, label: payload.label });
    } catch (error) {
      console.error(
        `Failed to resolve mirror ${payload.label}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  if (results.length === 0 && payloads.length > 0) {
    throw new MirrorResolveError("all mirror resolutions failed");
  }

  return results;
}

function extractIframeSrc(base64Html: string): string | null {
  const html = Buffer.from(base64Html, "base64").toString("utf8");
  const match = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}
