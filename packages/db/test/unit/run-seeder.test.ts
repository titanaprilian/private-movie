import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as clientModule from "../../src/client";
import { runSeeder } from "../../src/run-seeder";
import * as seedModule from "../../src/seed";

vi.mock("../../src/client", () => ({
  createDbClient: vi.fn(),
}));

vi.mock("../../src/seed", () => ({
  seed: vi.fn(),
}));

describe("runSeeder", () => {
  let mockEnd: ReturnType<typeof vi.fn>;
  let mockDb: any;
  let exitSpy: any;
  let logSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    mockEnd = vi.fn().mockResolvedValue(undefined);
    mockDb = {
      $client: {
        end: mockEnd,
      },
    };

    vi.mocked(clientModule.createDbClient).mockReturnValue(mockDb);
    vi.mocked(seedModule.seed).mockResolvedValue(undefined);

    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as any);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("seeds the database successfully, terminates the client, and exits with 0", async () => {
    await runSeeder();

    expect(clientModule.createDbClient).toHaveBeenCalledTimes(1);
    expect(seedModule.seed).toHaveBeenCalledWith(mockDb);
    expect(logSpy).toHaveBeenCalledWith("Database seeded successfully.");
    expect(mockEnd).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("handles seeding failures, terminates the client, and exits with 1", async () => {
    const error = new Error("Connection failed");
    vi.mocked(seedModule.seed).mockRejectedValueOnce(error);

    await runSeeder();

    expect(errorSpy).toHaveBeenCalledWith("Database seeding failed:", error);
    expect(mockEnd).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("handles client termination rejection during error handling gracefully", async () => {
    const seedError = new Error("Query timeout");
    vi.mocked(seedModule.seed).mockRejectedValueOnce(seedError);
    mockEnd.mockRejectedValueOnce(new Error("Socket already closed"));

    await runSeeder();

    expect(errorSpy).toHaveBeenCalledWith(
      "Database seeding failed:",
      seedError,
    );
    expect(mockEnd).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
