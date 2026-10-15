import type { DbClient } from "@repo/db";

export const checkHealth = async (db: DbClient): Promise<boolean> => {
  const rows = await db.$client.unsafe("SELECT 1 AS ok");
  return rows.length === 1;
};
