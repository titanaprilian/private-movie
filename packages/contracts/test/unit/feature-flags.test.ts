import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAGS,
  type FeatureFlagKey,
  type FeatureFlagOptions,
  type FeatureFlagOverrides,
  isFeatureEnabled,
} from "../../src";

describe("Feature flags registry and resolver", () => {
  const flags = Object.values(FEATURE_FLAGS);
  const flagArb = fc.constantFrom(...flags);

  describe("Registry definitions and defaults", () => {
    it("exports canonical FEATURE_FLAGS const with all expected flag keys", () => {
      expect(FEATURE_FLAGS).toEqual({
        USE_STREAMING_ARCHIVE_EXTRACTOR: "USE_STREAMING_ARCHIVE_EXTRACTOR",
        EXPERIMENTAL_PLAYER_UI: "EXPERIMENTAL_PLAYER_UI",
      });
    });

    it("defaults every registered flag to false in DEFAULT_FEATURE_FLAGS", () => {
      for (const flag of flags) {
        expect(DEFAULT_FEATURE_FLAGS[flag]).toBe(false);
      }
    });

    it("freezes DEFAULT_FEATURE_FLAGS to prevent runtime mutations", () => {
      expect(Object.isFrozen(DEFAULT_FEATURE_FLAGS)).toBe(true);
    });

    it("resolves default false when called with no options or empty options in isolated env", () => {
      for (const flag of flags) {
        expect(isFeatureEnabled(flag, { env: {} })).toBe(false);
        expect(isFeatureEnabled(flag, {})).toBe(false);
        expect(isFeatureEnabled(flag, { overrides: {}, env: {} })).toBe(false);
      }
    });

    it("falls back to false for unknown or unconfigured flags", () => {
      expect(
        isFeatureEnabled("UNKNOWN_FLAG" as FeatureFlagKey, { env: {} }),
      ).toBe(false);
    });
  });

  describe("Direct and options overrides", () => {
    it("resolves direct FeatureFlagOverrides dictionary", () => {
      const overrides: FeatureFlagOverrides = {
        USE_STREAMING_ARCHIVE_EXTRACTOR: true,
        EXPERIMENTAL_PLAYER_UI: false,
      };

      expect(
        isFeatureEnabled(
          FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR,
          overrides,
        ),
      ).toBe(true);
      expect(
        isFeatureEnabled(FEATURE_FLAGS.EXPERIMENTAL_PLAYER_UI, overrides),
      ).toBe(false);
    });

    it("resolves overrides wrapped in FeatureFlagOptions", () => {
      const options: FeatureFlagOptions = {
        overrides: {
          EXPERIMENTAL_PLAYER_UI: true,
        },
        env: {},
      };

      expect(
        isFeatureEnabled(FEATURE_FLAGS.EXPERIMENTAL_PLAYER_UI, options),
      ).toBe(true);
      expect(
        isFeatureEnabled(
          FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR,
          options,
        ),
      ).toBe(false);
    });

    it("does not let an override for one flag affect other flags", () => {
      const overrides: FeatureFlagOverrides = {
        USE_STREAMING_ARCHIVE_EXTRACTOR: true,
      };

      expect(
        isFeatureEnabled(
          FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR,
          overrides,
        ),
      ).toBe(true);
      expect(
        isFeatureEnabled(FEATURE_FLAGS.EXPERIMENTAL_PLAYER_UI, {
          ...overrides,
          env: {},
        }),
      ).toBe(false);
    });
  });

  describe("Environment variable resolution", () => {
    it("parses truthy values ('true' and '1') as true", () => {
      expect(
        isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR, {
          env: { FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR: "true" },
        }),
      ).toBe(true);
      expect(
        isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR, {
          env: { FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR: "1" },
        }),
      ).toBe(true);
    });

    it("parses falsy values ('false' and '0') as false", () => {
      expect(
        isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR, {
          env: { FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR: "false" },
        }),
      ).toBe(false);
      expect(
        isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR, {
          env: { FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR: "0" },
        }),
      ).toBe(false);
    });

    it("handles case-insensitive env values and surrounding whitespace", () => {
      const variations = [
        "TRUE",
        "True",
        "tRuE",
        "  true  ",
        " 1 ",
        "\ttrue\n",
      ];
      for (const val of variations) {
        expect(
          isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR, {
            env: { FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR: val },
          }),
        ).toBe(true);
      }

      const falseVariations = [
        "FALSE",
        "False",
        "fAlSe",
        "  false  ",
        " 0 ",
        "\tfalse\n",
      ];
      for (const val of falseVariations) {
        expect(
          isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR, {
            env: { FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR: val },
          }),
        ).toBe(false);
      }
    });

    it("falls back to default for invalid or empty env var values", () => {
      const invalidValues = [
        "",
        " ",
        "yes",
        "no",
        "2",
        "-1",
        "enabled",
        "disabled",
        "undefined",
        "null",
      ];

      for (const val of invalidValues) {
        expect(
          isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR, {
            env: { FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR: val },
          }),
        ).toBe(false);
      }
    });
  });

  describe("Precedence order", () => {
    it("ensures overrides take precedence over environment variables", () => {
      // Override false beats env true / 1
      expect(
        isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR, {
          overrides: { USE_STREAMING_ARCHIVE_EXTRACTOR: false },
          env: { FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR: "true" },
        }),
      ).toBe(false);

      expect(
        isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR, {
          overrides: { USE_STREAMING_ARCHIVE_EXTRACTOR: false },
          env: { FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR: "1" },
        }),
      ).toBe(false);

      // Override true beats env false / 0
      expect(
        isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR, {
          overrides: { USE_STREAMING_ARCHIVE_EXTRACTOR: true },
          env: { FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR: "false" },
        }),
      ).toBe(true);

      expect(
        isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR, {
          overrides: { USE_STREAMING_ARCHIVE_EXTRACTOR: true },
          env: { FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR: "0" },
        }),
      ).toBe(true);
    });

    it("falls through to environment variables when override is undefined", () => {
      expect(
        isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR, {
          overrides: { USE_STREAMING_ARCHIVE_EXTRACTOR: undefined },
          env: { FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR: "true" },
        }),
      ).toBe(true);
    });

    it("falls through to default when override is undefined and env is missing or invalid", () => {
      expect(
        isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR, {
          overrides: { USE_STREAMING_ARCHIVE_EXTRACTOR: undefined },
          env: { FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR: "invalid" },
        }),
      ).toBe(false);

      expect(
        isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR, {
          overrides: {},
          env: {},
        }),
      ).toBe(false);
    });
  });

  describe("Global process.env fallback", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      delete process.env.FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR;
      delete process.env.FEATURE_FLAG_EXPERIMENTAL_PLAYER_UI;
    });

    afterEach(() => {
      for (const key of Object.keys(process.env)) {
        if (key.startsWith("FEATURE_FLAG_")) {
          delete process.env[key];
        }
      }
      Object.assign(process.env, originalEnv);
    });

    it("reads from process.env when options.env is not provided", () => {
      process.env.FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR = "1";
      expect(
        isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR),
      ).toBe(true);

      process.env.FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR = "false";
      expect(
        isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR),
      ).toBe(false);
    });

    it("prefers explicit overrides over process.env", () => {
      process.env.FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR = "1";
      expect(
        isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR, {
          USE_STREAMING_ARCHIVE_EXTRACTOR: false,
        }),
      ).toBe(false);
    });

    it("prefers options.env over process.env when provided", () => {
      process.env.FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR = "1";
      expect(
        isFeatureEnabled(FEATURE_FLAGS.USE_STREAMING_ARCHIVE_EXTRACTOR, {
          env: { FEATURE_FLAG_USE_STREAMING_ARCHIVE_EXTRACTOR: "0" },
        }),
      ).toBe(false);
    });
  });

  describe("Property-based tests", () => {
    it("guarantees resolution idempotency and stability across runs", () => {
      fc.assert(
        fc.property(
          flagArb,
          fc.option(fc.boolean(), { nil: undefined }),
          fc.option(fc.string(), { nil: undefined }),
          (flag, overrideVal, envVal) => {
            const options: FeatureFlagOptions = {
              overrides: { [flag]: overrideVal },
              env: { [`FEATURE_FLAG_${flag}`]: envVal },
            };

            const first = isFeatureEnabled(flag, options);
            const second = isFeatureEnabled(flag, options);
            expect(first).toBe(second);
            return first === second;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("guarantees override precedence invariant: boolean override always wins regardless of env", () => {
      fc.assert(
        fc.property(
          flagArb,
          fc.boolean(),
          fc.string(),
          (flag, overrideVal, envVal) => {
            const options: FeatureFlagOptions = {
              overrides: { [flag]: overrideVal },
              env: { [`FEATURE_FLAG_${flag}`]: envVal },
            };

            const result = isFeatureEnabled(flag, options);
            expect(result).toBe(overrideVal);
            return result === overrideVal;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("guarantees env parsing invariant for arbitrary string env values without overrides", () => {
      fc.assert(
        fc.property(flagArb, fc.string(), (flag, rawEnv) => {
          const result = isFeatureEnabled(flag, {
            env: { [`FEATURE_FLAG_${flag}`]: rawEnv },
          });

          const normalized = rawEnv.trim().toLowerCase();
          if (normalized === "true" || normalized === "1") {
            expect(result).toBe(true);
            return result === true;
          }
          if (normalized === "false" || normalized === "0") {
            expect(result).toBe(false);
            return result === false;
          }
          expect(result).toBe(DEFAULT_FEATURE_FLAGS[flag]);
          return result === DEFAULT_FEATURE_FLAGS[flag];
        }),
        { numRuns: 100 },
      );
    });

    it("never throws for arbitrary string inputs as flags and option structures", () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.dictionary(
            fc.string(),
            fc.option(fc.boolean(), { nil: undefined }),
          ),
          fc.dictionary(
            fc.string(),
            fc.option(fc.string(), { nil: undefined }),
          ),
          (flag, overrides, env) => {
            expect(() =>
              isFeatureEnabled(flag as FeatureFlagKey, {
                overrides: overrides as FeatureFlagOverrides,
                env,
              }),
            ).not.toThrow();
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
