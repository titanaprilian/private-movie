export * from "@repo/media-service";
export {
  createOngoingSeasonScheduler,
  startOngoingSeasonScheduler,
  SCHEDULER_DEFAULT_INTERVAL_MINUTES,
  SCHEDULER_DEFAULT_ENABLED,
} from "./internal/scheduler/scheduler";
export type {
  OngoingSeasonScheduler,
  OngoingSeasonSchedulerOptions,
  SchedulerLastRunResult,
  StartOngoingSeasonSchedulerOptions,
} from "./internal/types";
export {
  loadSchedulerConfig,
  saveSchedulerConfig,
  validateSchedulerConfigInput,
  ALLOWED_SCHEDULER_INTERVALS,
  DEFAULT_SCHEDULER_INTERVAL_MINUTES,
  DEFAULT_SCHEDULER_ENABLED,
} from "./internal/scheduler/scheduler-config";
export type { SchedulerConfig, SchedulerConfigDb } from "./internal/types";
export {
  RELAY_CDN_HOST_FRAGMENTS,
  RELAY_CDN_REFERER,
  RELAY_EMBED_REFERER,
  EMBED_UPSTREAM_ORIGIN,
  EMBED_USER_AGENT,
  resolveRelayReferer,
} from "./internal/proxy/utils/transport";
export {
  AD_SUPPRESSION_SHIM,
  VIDHIDE_ANTI_CLICKJACK_CSS,
  KNOWN_AD_SCRIPT_PATTERNS,
  BLOCKED_APP_SCHEMES,
  isBlockedAdAsset,
  isBlockedAppSchemeUrl,
  stripKnownAdScripts,
} from "./internal/embed/utils/ad-suppression";
export {
  MOBILE_VIDEO_SHIM,
  EMBED_SW_CLEANUP_SHIM,
  DEBUG_LOGGER_SHIM,
  WEBCRYPTO_INSECURE_POLYFILL_SHIM,
  buildRelayInterceptorShim,
  buildServerRenderedEmbedDocument,
  buildEmbedErrorDocument,
  enforceMobileVideoAttributes,
} from "./internal/embed/document";
export {
  buildProxyBaseHref,
  sanitizeHtmlContent,
} from "./internal/proxy/sanitize";
