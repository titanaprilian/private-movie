import { describe, expect, it, vi } from "vitest";
import {
  loadServerConfig,
  DEFAULT_PORT,
  DEFAULT_HOSTNAME,
  DEFAULT_MAX_UPLOAD_MB,
  DEFAULT_IDLE_TIMEOUT,
  BYTES_PER_MIB,
  MULTIPART_OVERHEAD_BYTES,
} from "@/config/server-config";

describe("loadServerConfig", () => {
  it("applies defaults for an empty environment", () => {
    expect(loadServerConfig({})).toEqual({
      port: DEFAULT_PORT,
      hostname: DEFAULT_HOSTNAME,
      maxRequestBodySize:
        DEFAULT_MAX_UPLOAD_MB * BYTES_PER_MIB + MULTIPART_OVERHEAD_BYTES,
      idleTimeout: DEFAULT_IDLE_TIMEOUT,
    });
  });

  it("applies a valid port, hostname, and upload limit", () => {
    const config = loadServerConfig({
      PORT: "4000",
      HOST: "127.0.0.1",
      MAX_UPLOAD_SIZE_MB: "512",
    });
    expect(config.port).toBe(4000);
    expect(config.hostname).toBe("127.0.0.1");
    expect(config.maxRequestBodySize).toBe(
      512 * BYTES_PER_MIB + MULTIPART_OVERHEAD_BYTES
    );
    expect(config.idleTimeout).toBe(0);
  });

  it("falls back to the default port for missing or invalid values", () => {
    expect(loadServerConfig({}).port).toBe(3000);
    expect(loadServerConfig({ PORT: "" }).port).toBe(3000);
    expect(loadServerConfig({ PORT: "not-a-port" }).port).toBe(3000);
    expect(loadServerConfig({ PORT: "0" }).port).toBe(3000);
    expect(loadServerConfig({ PORT: "-1" }).port).toBe(3000);
    expect(loadServerConfig({ PORT: "65536" }).port).toBe(3000);
    expect(loadServerConfig({ PORT: "3000.5" }).port).toBe(3000);
  });

  it("accepts boundary ports", () => {
    expect(loadServerConfig({ PORT: "1" }).port).toBe(1);
    expect(loadServerConfig({ PORT: "65535" }).port).toBe(65535);
  });

  it("falls back to the default hostname only when unset", () => {
    expect(loadServerConfig({}).hostname).toBe("0.0.0.0");
    expect(loadServerConfig({ HOST: "example.internal" }).hostname).toBe(
      "example.internal"
    );
  });

  it("falls back to the default upload limit for missing or invalid values", () => {
    const expected =
      DEFAULT_MAX_UPLOAD_MB * BYTES_PER_MIB + MULTIPART_OVERHEAD_BYTES;
    expect(loadServerConfig({}).maxRequestBodySize).toBe(expected);
    expect(loadServerConfig({ MAX_UPLOAD_SIZE_MB: "" }).maxRequestBodySize).toBe(
      expected
    );
    expect(
      loadServerConfig({ MAX_UPLOAD_SIZE_MB: "huge" }).maxRequestBodySize
    ).toBe(expected);
    expect(loadServerConfig({ MAX_UPLOAD_SIZE_MB: "0" }).maxRequestBodySize).toBe(
      expected
    );
    expect(
      loadServerConfig({ MAX_UPLOAD_SIZE_MB: "-10" }).maxRequestBodySize
    ).toBe(expected);
  });

  it("never inspects global process state beyond the injected dictionary", () => {
    const config = loadServerConfig({
      PORT: "4321",
      HOST: "10.0.0.5",
      MAX_UPLOAD_SIZE_MB: "256",
    });
    expect(config).toEqual({
      port: 4321,
      hostname: "10.0.0.5",
      maxRequestBodySize: 256 * BYTES_PER_MIB + MULTIPART_OVERHEAD_BYTES,
      idleTimeout: 0,
    });
  });
});
