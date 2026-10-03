import { eq } from "drizzle-orm";
import { system, type DbClient } from "@repo/db";

export const SCHEDULER_INTERVAL_KEY = "scheduler_interval_minutes";
export const SCHEDULER_ENABLED_KEY = "scheduler_enabled";

export const ALLOWED_SCHEDULER_INTERVALS = [15, 30, 60, 180, 360, 720, 1440] as const;
export const DEFAULT_SCHEDULER_INTERVAL_MINUTES = 30;
export const DEFAULT_SCHEDULER_ENABLED = true;

export interface SchedulerConfig {
  intervalMinutes: number;
  isEnabled: boolean;
}

export type SchedulerConfigDb = Pick<DbClient, "select" | "insert"> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

async function readKey(db: SchedulerConfigDb, key: string): Promise<string | null> {
  const rows = await db.select({ value: system.value }).from(system).where(eq(system.key, key));
  return rows[0]?.value ?? null;
}

export async function loadSchedulerConfig(db: SchedulerConfigDb): Promise<SchedulerConfig> {
  let intervalMinutes = DEFAULT_SCHEDULER_INTERVAL_MINUTES;
  let isEnabled = DEFAULT_SCHEDULER_ENABLED;
  try {
    const rawInterval = await readKey(db, SCHEDULER_INTERVAL_KEY);
    if (rawInterval !== null) {
      const parsed = Number.parseInt(rawInterval, 10);
      if (Number.isFinite(parsed) && (ALLOWED_SCHEDULER_INTERVALS as readonly number[]).includes(parsed)) {
        intervalMinutes = parsed;
      }
    }
    const rawEnabled = await readKey(db, SCHEDULER_ENABLED_KEY);
    if (rawEnabled !== null) {
      isEnabled = rawEnabled === "true";
    }
  } catch {
    // system table may not exist yet (pre-migration); fall back to defaults.
  }
  return { intervalMinutes, isEnabled };
}

export async function saveSchedulerConfig(
  db: SchedulerConfigDb,
  config: Partial<SchedulerConfig>,
): Promise<SchedulerConfig> {
  const current = await loadSchedulerConfig(db);
  const next: SchedulerConfig = {
    intervalMinutes: config.intervalMinutes ?? current.intervalMinutes,
    isEnabled: config.isEnabled ?? current.isEnabled,
  };
  const now = new Date();
  for (const [key, value] of [
    [SCHEDULER_INTERVAL_KEY, String(next.intervalMinutes)],
    [SCHEDULER_ENABLED_KEY, String(next.isEnabled)],
  ] as const) {
    await db
      .insert(system)
      .values({ id: key, key, value, createdAt: now })
      .onConflictDoUpdate({ target: system.key, set: { value } });
  }
  return next;
}

export function validateSchedulerConfigInput(input: {
  intervalMinutes?: unknown;
  isEnabled?: unknown;
}): { valid: boolean; message?: string } {
  if (input.intervalMinutes !== undefined) {
    if (
      typeof input.intervalMinutes !== "number" ||
      !Number.isInteger(input.intervalMinutes) ||
      !(ALLOWED_SCHEDULER_INTERVALS as readonly number[]).includes(input.intervalMinutes)
    ) {
      return {
        valid: false,
        message: `intervalMinutes must be one of: ${ALLOWED_SCHEDULER_INTERVALS.join(", ")}`,
      };
    }
  }
  if (input.isEnabled !== undefined && typeof input.isEnabled !== "boolean") {
    return { valid: false, message: "isEnabled must be a boolean" };
  }
  return { valid: true };
}
