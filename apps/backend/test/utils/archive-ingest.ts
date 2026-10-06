import type { ArchiveIngestJob } from "@repo/contracts";

/**
 * Poll a job getter until it reaches one of the expected terminal statuses.
 * Never use fixed sleeps — poll with a short interval and a generous timeout.
 */
export async function waitForJobStatus(
  getJob: (jobId: string) => Promise<ArchiveIngestJob | null>,
  jobId: string,
  expected: string | string[],
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<ArchiveIngestJob> {
  const wanted = new Set(Array.isArray(expected) ? expected : [expected]);
  const timeoutMs = options.timeoutMs ?? 15000;
  const intervalMs = options.intervalMs ?? 50;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const current = await getJob(jobId);
    if (current && wanted.has(current.status)) return current;
    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out waiting for job ${jobId} to reach ${[...wanted].join("/")} (last: ${current?.status ?? "null"})`
      );
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
