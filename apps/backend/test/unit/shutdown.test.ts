import { describe, expect, it, vi } from "vitest";
import {
  createShutdownManager,
  SHUTDOWN_TIMEOUT_MS,
  type ShutdownProcess,
  type ShutdownTimers,
} from "@/shutdown/shutdown-manager";

function createFakeProcess(): ShutdownProcess & {
  handlers: Record<string, Array<() => void>>;
  exits: number[];
  emit(event: "SIGINT" | "SIGTERM"): void;
} {
  const handlers: Record<string, Array<() => void>> = {};
  const exits: number[] = [];
  return {
    handlers,
    exits,
    on(event, handler) {
      handlers[event] ??= [];
      handlers[event].push(handler);
    },
    exit(code) {
      exits.push(code);
    },
    emit(event) {
      for (const handler of handlers[event] ?? []) {
        handler();
      }
    },
  };
}

function createManualTimers(): ShutdownTimers & {
  fireAll(): void;
  pendingCount(): number;
} {
  let nextId = 0;
  const pending = new Map<number, () => void>();
  return {
    setTimeout(fn) {
      const id = nextId++;
      pending.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      pending.delete(id as number);
    },
    fireAll() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const fn of callbacks) {
        fn();
      }
    },
    pendingCount() {
      return pending.size;
    },
  };
}

const silentLogger = { error: vi.fn() };

describe("createShutdownManager", () => {
  it("exposes the 10-second timeout guarantee", () => {
    expect(SHUTDOWN_TIMEOUT_MS).toBe(10_000);
  });

  it("executes registered steps in sequential order and exits 0", async () => {
    const order: string[] = [];
    const proc = createFakeProcess();
    const manager = createShutdownManager({
      proc,
      timers: createManualTimers(),
      logger: silentLogger,
      steps: [
        { name: "http", run: () => void order.push("http") },
        {
          name: "scheduler",
          run: async () => {
            await Promise.resolve();
            order.push("scheduler");
          },
        },
        { name: "browser", run: () => void order.push("browser") },
        { name: "db", run: () => void order.push("db") },
      ],
    });

    await manager.shutdown();

    expect(order).toEqual(["http", "scheduler", "browser", "db"]);
    expect(proc.exits).toEqual([0]);
  });

  it("supports steps appended after creation", async () => {
    const order: string[] = [];
    const proc = createFakeProcess();
    const manager = createShutdownManager({ proc, logger: silentLogger });
    manager.addStep({ name: "late", run: () => void order.push("late") });

    await manager.shutdown();

    expect(order).toEqual(["late"]);
    expect(proc.exits).toEqual([0]);
  });

  it("isolates step failures and exits 1 without skipping later steps", async () => {
    const order: string[] = [];
    const logger = { error: vi.fn() };
    const proc = createFakeProcess();
    const failure = new Error("scheduler stop failed");
    const manager = createShutdownManager({
      proc,
      timers: createManualTimers(),
      logger,
      steps: [
        { name: "http", run: () => void order.push("http") },
        {
          name: "scheduler",
          run: () => {
            throw failure;
          },
        },
        { name: "db", run: () => void order.push("db") },
      ],
    });

    await manager.shutdown();

    expect(order).toEqual(["http", "db"]);
    expect(logger.error).toHaveBeenCalledWith(
      '[Shutdown] step "scheduler" failed',
      failure
    );
    expect(proc.exits).toEqual([1]);
  });

  it("ignores a duplicate shutdown while one is already in progress", async () => {
    let runs = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const proc = createFakeProcess();
    const manager = createShutdownManager({
      proc,
      timers: createManualTimers(),
      logger: silentLogger,
      steps: [
        {
          name: "slow",
          run: async () => {
            runs += 1;
            await gate;
          },
        },
      ],
    });

    const first = manager.shutdown();
    const second = manager.shutdown();
    release();
    await Promise.all([first, second]);

    expect(runs).toBe(1);
    expect(proc.exits).toEqual([0]);
  });

  it("binds SIGINT and SIGTERM to a single execution path", async () => {
    let runs = 0;
    const proc = createFakeProcess();
    const manager = createShutdownManager({
      proc,
      timers: createManualTimers(),
      logger: silentLogger,
      steps: [{ name: "only", run: () => void (runs += 1) }],
    });
    manager.registerShutdownHandlers();

    expect(proc.handlers["SIGINT"]).toHaveLength(1);
    expect(proc.handlers["SIGTERM"]).toHaveLength(1);

    proc.emit("SIGINT");
    proc.emit("SIGTERM");
    await Promise.resolve();
    await Promise.resolve();

    expect(runs).toBe(1);
    expect(proc.exits).toEqual([0]);
  });

  it("forces exit code 1 when cleanup exceeds the timeout", async () => {
    const proc = createFakeProcess();
    const timers = createManualTimers();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const manager = createShutdownManager({
      proc,
      timers,
      logger: silentLogger,
      timeoutMs: 10_000,
      steps: [
        {
          name: "hanging",
          run: () => gate,
        },
      ],
    });

    const pending = manager.shutdown();
    expect(timers.pendingCount()).toBe(1);
    timers.fireAll();
    expect(proc.exits).toEqual([1]);

    release();
    await pending;
    // The timed-out shutdown already settled the process exactly once.
    expect(proc.exits).toEqual([1]);
  });

  it("clears the timeout timer on clean shutdown", async () => {
    const proc = createFakeProcess();
    const timers = createManualTimers();
    const manager = createShutdownManager({
      proc,
      timers,
      logger: silentLogger,
      steps: [{ name: "fast", run: () => {} }],
    });

    await manager.shutdown();

    expect(timers.pendingCount()).toBe(0);
    expect(proc.exits).toEqual([0]);
  });
});
