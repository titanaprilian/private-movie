import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_DATABASE_URL,
  MIGRATIONS_FOLDER,
  createDbClient,
} from "../../src/client";

describe("db client", () => {
  const originalEnvUrl = process.env.DATABASE_URL;

  afterEach(async () => {
    if (originalEnvUrl !== undefined) {
      process.env.DATABASE_URL = originalEnvUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  describe("constants & paths", () => {
    it("exports DEFAULT_DATABASE_URL pointing to local postgres", () => {
      expect(DEFAULT_DATABASE_URL).toBe(
        "postgres://postgres:root_password@localhost:5432/private_movie",
      );
    });

    it("exports MIGRATIONS_FOLDER pointing to existing drizzle directory", () => {
      expect(MIGRATIONS_FOLDER).toBeDefined();
      expect(MIGRATIONS_FOLDER.endsWith("/drizzle")).toBe(true);
      expect(fs.existsSync(MIGRATIONS_FOLDER)).toBe(true);
    });
  });

  describe("createDbClient configuration behavior", () => {
    it("falls back to DEFAULT_DATABASE_URL when no argument and no env var", async () => {
      delete process.env.DATABASE_URL;
      const db = createDbClient();
      try {
        expect(db).toBeDefined();
        expect(db.$client).toBeDefined();
        expect(db.$client.options.database).toBe("private_movie");
        expect(db.$client.options.user).toBe("postgres");
        expect(db.$client.options.pass).toBe("root_password");
        expect(db.$client.options.host).toEqual(["localhost"]);
        expect(db.$client.options.port).toEqual([5432]);
      } finally {
        await db.$client.end({ timeout: 0 });
      }
    });

    it("respects process.env.DATABASE_URL when no argument is passed", async () => {
      process.env.DATABASE_URL =
        "postgres://envuser:envpass@127.0.0.1:5439/envdatabase";
      const db = createDbClient();
      try {
        expect(db.$client.options.database).toBe("envdatabase");
        expect(db.$client.options.user).toBe("envuser");
        expect(db.$client.options.pass).toBe("envpass");
        expect(db.$client.options.host).toEqual(["127.0.0.1"]);
        expect(db.$client.options.port).toEqual([5439]);
      } finally {
        await db.$client.end({ timeout: 0 });
      }
    });

    it("prioritizes explicit databaseUrl argument over process.env.DATABASE_URL", async () => {
      process.env.DATABASE_URL =
        "postgres://envuser:envpass@127.0.0.1:5439/envdatabase";
      const db = createDbClient(
        "postgres://arguser:argpass@127.0.0.1:5440/argdatabase",
      );
      try {
        expect(db.$client.options.database).toBe("argdatabase");
        expect(db.$client.options.user).toBe("arguser");
        expect(db.$client.options.pass).toBe("argpass");
        expect(db.$client.options.host).toEqual(["127.0.0.1"]);
        expect(db.$client.options.port).toEqual([5440]);
      } finally {
        await db.$client.end({ timeout: 0 });
      }
    });

    it("correctly parses connection options and pool config from query params", async () => {
      const db = createDbClient(
        "postgres://user:pass@127.0.0.1:5432/testdb?max=15&idle_timeout=25&connect_timeout=5",
      );
      try {
        expect(db.$client.options.database).toBe("testdb");
        expect(db.$client.options.max).toBe("15");
        expect(db.$client.options.idle_timeout).toBe(25);
        expect(db.$client.options.connect_timeout).toBe(5);
      } finally {
        await db.$client.end({ timeout: 0 });
      }
    });

    it("allows clean termination of client connection", async () => {
      const db = createDbClient();
      await expect(db.$client.end({ timeout: 0 })).resolves.toBeUndefined();
    });
  });
});
