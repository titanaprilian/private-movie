import { describe, expect, it, vi } from "vitest";
import { refreshTokens, system, users } from "../../src/schema";
import { seed } from "../../src/seed";

describe("seed", () => {
  function createMockDb() {
    const deletedTables: any[] = [];
    const insertedValues: { table: any; values: any[] }[] = [];

    const deleteMock = vi.fn().mockImplementation((table: any) => {
      deletedTables.push(table);
      return Promise.resolve();
    });

    const insertMock = vi.fn().mockImplementation((table: any) => ({
      values: vi.fn().mockImplementation((values: any[]) => {
        insertedValues.push({ table, values });
        return Promise.resolve();
      }),
    }));

    const mockDb = {
      delete: deleteMock,
      insert: insertMock,
    } as any;

    return { mockDb, deleteMock, insertMock, deletedTables, insertedValues };
  }

  it("deletes child tables before parent tables to respect foreign keys", async () => {
    const { mockDb, deletedTables } = createMockDb();

    await seed(mockDb);

    expect(deletedTables).toHaveLength(3);
    expect(deletedTables[0]).toBe(refreshTokens);
    expect(deletedTables[1]).toBe(users);
    expect(deletedTables[2]).toBe(system);
  });

  it("inserts deterministic base user records", async () => {
    const { mockDb, insertedValues } = createMockDb();

    await seed(mockDb);

    const userInsert = insertedValues.find((entry) => entry.table === users);
    expect(userInsert).toBeDefined();
    expect(userInsert?.values).toHaveLength(2);

    expect(userInsert?.values[0]).toMatchObject({
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      failedAttempts: 0,
      lockedUntil: null,
      sessionsValidAfter: null,
    });
    expect(userInsert?.values[0].passwordHash).toBeDefined();
    expect(userInsert?.values[0].createdAt).toBeInstanceOf(Date);

    expect(userInsert?.values[1]).toMatchObject({
      id: "user-2",
      name: "Standard User",
      email: "user@example.com",
      failedAttempts: 0,
      lockedUntil: null,
      sessionsValidAfter: null,
    });
    expect(userInsert?.values[1].passwordHash).toBeDefined();
    expect(userInsert?.values[1].createdAt).toBeInstanceOf(Date);
  });

  it("inserts deterministic base system settings", async () => {
    const { mockDb, insertedValues } = createMockDb();

    await seed(mockDb);

    const systemInsert = insertedValues.find((entry) => entry.table === system);
    expect(systemInsert).toBeDefined();
    expect(systemInsert?.values).toHaveLength(2);

    expect(systemInsert?.values).toEqual([
      {
        id: "sys-1",
        key: "environment",
        value: "development",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "sys-2",
        key: "version",
        value: "1.0.0",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
  });

  it("propagates deletion errors and aborts subsequent operations", async () => {
    const deleteError = new Error("DB connection error during delete");
    const mockDb = {
      delete: vi.fn().mockRejectedValueOnce(deleteError),
      insert: vi.fn(),
    } as any;

    await expect(seed(mockDb)).rejects.toThrow(
      "DB connection error during delete",
    );
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("propagates insertion errors", async () => {
    const insertError = new Error("Unique constraint violation on insert");
    const mockDb = {
      delete: vi.fn().mockResolvedValue(undefined),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockRejectedValueOnce(insertError),
      }),
    } as any;

    await expect(seed(mockDb)).rejects.toThrow(
      "Unique constraint violation on insert",
    );
  });
});
