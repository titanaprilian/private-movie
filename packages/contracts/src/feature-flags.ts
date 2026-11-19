export const FEATURE_FLAGS = {
  USE_STREAMING_ARCHIVE_EXTRACTOR: "USE_STREAMING_ARCHIVE_EXTRACTOR",
  EXPERIMENTAL_PLAYER_UI: "EXPERIMENTAL_PLAYER_UI",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export const DEFAULT_FEATURE_FLAGS: Readonly<Record<FeatureFlagKey, boolean>> =
  Object.freeze({
    [FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR]: false,
    [FEATURE_FLAGS.EXPERIMENTAL_PLAYER_UI]: false,
  });

export type FeatureFlagOverrides = Partial<Record<FeatureFlagKey, boolean>>;

export interface FeatureFlagOptions {
  overrides?: FeatureFlagOverrides;
  env?: Record<string, string | undefined>;
}

export function isFeatureEnabled(
  flag: FeatureFlagKey,
  options?: FeatureFlagOverrides | FeatureFlagOptions,
): boolean {
  let overrides: FeatureFlagOverrides | undefined;
  let env: Record<string, string | undefined> | undefined;

  if (options && typeof options === "object") {
    if ("overrides" in options || "env" in options) {
      const opts = options as FeatureFlagOptions;
      overrides = opts.overrides;
      env = opts.env;
    } else {
      overrides = options as FeatureFlagOverrides;
    }
  }

  if (overrides && typeof overrides[flag] === "boolean") {
    return overrides[flag]!;
  }

  const envSource =
    env !== undefined
      ? env
      : typeof process !== "undefined"
        ? process.env
        : undefined;

  if (envSource) {
    const rawVal = envSource[`FEATURE_FLAG_${flag}`];
    if (typeof rawVal === "string") {
      const normalized = rawVal.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") {
        return true;
      }
      if (normalized === "false" || normalized === "0") {
        return false;
      }
    }
  }

  return DEFAULT_FEATURE_FLAGS[flag] ?? false;
}
