export * from "@repo/media-service";
export * from "./scheduler";
export {
  RELAY_CDN_HOST_FRAGMENTS,
  RELAY_CDN_REFERER,
  RELAY_EMBED_REFERER,
  EMBED_UPSTREAM_ORIGIN,
  EMBED_USER_AGENT,
  MOBILE_VIDEO_SHIM,
  resolveRelayReferer,
  buildRelayInterceptorShim,
  buildServerRenderedEmbedDocument,
  buildEmbedErrorDocument,
  enforceMobileVideoAttributes,
} from "./internal/proxy-helpers";
