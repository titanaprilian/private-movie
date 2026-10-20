import type { SourceProbeResult } from "../types";

/**
 * Protocol-independent video source reachability check: issues a HEAD
 * request and falls back to a ranged GET when the upstream rejects HEAD
 * (405/403), reporting whether the source is reachable.
 */
export async function probeVideoSource(
  targetUrl: URL,
  referer?: string
): Promise<SourceProbeResult> {
  const startTime = Date.now();
  const outboundHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  };

  if (referer && referer.trim().length > 0) {
    outboundHeaders["Referer"] = referer.trim();
  } else {
    outboundHeaders["Referer"] = targetUrl.origin;
  }

  try {
    const headRes = await fetch(targetUrl.toString(), {
      method: "HEAD",
      headers: outboundHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });

    if (headRes.ok || (headRes.status >= 200 && headRes.status < 400)) {
      return {
        status: "working",
        statusCode: headRes.status,
        latencyMs: Date.now() - startTime,
        error: null,
      };
    }

    if (headRes.status === 405 || headRes.status === 403) {
      const getRes = await fetch(targetUrl.toString(), {
        method: "GET",
        headers: {
          ...outboundHeaders,
          Range: "bytes=0-0",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });

      if (
        getRes.ok ||
        getRes.status === 206 ||
        (getRes.status >= 200 && getRes.status < 400)
      ) {
        return {
          status: "working",
          statusCode: getRes.status,
          latencyMs: Date.now() - startTime,
          error: null,
        };
      }

      return {
        status: "broken",
        statusCode: getRes.status,
        latencyMs: Date.now() - startTime,
        error: `Target server returned HTTP ${getRes.status}: ${getRes.statusText}`,
      };
    }

    return {
      status: "broken",
      statusCode: headRes.status,
      latencyMs: Date.now() - startTime,
      error: `Target server returned HTTP ${headRes.status}: ${headRes.statusText}`,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      status: "broken",
      statusCode: null,
      latencyMs,
      error: errorMessage,
    };
  }
}
