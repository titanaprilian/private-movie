import { describe, expect, it } from "vitest";
import { getClientIp } from "../../../src/lib/ip";

describe("getClientIp", () => {
  it("prioritizes x-forwarded-for first hop IP", () => {
    const req = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
        "x-real-ip": "198.51.100.1",
      },
    });
    const ip = getClientIp(req);
    expect(ip).toBe("203.0.113.195");
  });

  it("uses x-real-ip when x-forwarded-for is missing", () => {
    const req = new Request("http://localhost/api/test", {
      headers: {
        "x-real-ip": "198.51.100.1",
      },
    });
    const ip = getClientIp(req);
    expect(ip).toBe("198.51.100.1");
  });

  it("uses server requestIP when headers are missing", () => {
    const req = new Request("http://localhost/api/test");
    const server = {
      requestIP: () => ({ address: "192.168.1.50" }),
    };
    const ip = getClientIp(req, server);
    expect(ip).toBe("192.168.1.50");
  });

  it("falls back to 127.0.0.1 when no IP information is available", () => {
    const req = new Request("http://localhost/api/test");
    const ip = getClientIp(req);
    expect(ip).toBe("127.0.0.1");
  });
});
