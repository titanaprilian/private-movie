---
name: archive-ingest-capacity
description: Check archive ingest queue admission whenever submitJob, pumpQueue, active-status counting, or concurrency configuration changes.
---

# Archive ingest capacity

Check whether concurrent archive-ingest submissions can exceed the configured active-job limit. A capacity breach lets parallel downloads consume more network, disk, and worker resources than `maxConcurrentJobs` allows.

## Run the model

Make a scratch directory outside the repository and copy in the model files:

```sh
scratch=$(mktemp -d)
cp .agents/skills/archive-ingest-capacity/ArchiveIngestCapacity.tla .agents/skills/archive-ingest-capacity/capacity*.cfg "$scratch/"
```

Run the current implementation model from the scratch directory:

```sh
/statechart "$scratch/ArchiveIngestCapacity.tla" --config "$scratch/capacity.cfg" --out "$scratch/current"
```

Expect exit code `1` and a counterexample for `ActiveWithinLimit`. Read the trace with `/statechart`.

Run the atomic-admission control:

```sh
/statechart "$scratch/ArchiveIngestCapacity.tla" --config "$scratch/capacity-fixed.cfg" --out "$scratch/atomic"
```

Expect exit code `0` and `ActiveWithinLimit` to hold. Keep each output directory new and outside the repository.

The current-mode failure is a known implementation violation, not a successful verification. The control shows the invariant holds when each admission checks and reserves its slot in one atomic step. Do not mark the implementation verified until it uses an equivalent atomic reservation and the matching model passes.

The model starts with one occupied slot and two requests. In current mode, each request reads the active count before it creates or queues its job, as `submitJob` does in `apps/backend/src/modules/series/internal/archive-ingest/services/job.ts`. `StartDownload` models the later `createJob` and `executeJobPipeline`. The actions can interleave between those awaits. In atomic mode, `AtomicAdmit` combines the capacity check and slot reservation. The model abstracts the database to an active count. It excludes network, filesystem, retries, queue pumping, and the partial unique index for duplicate `(ownerId, sourceKey)` jobs.

## Interpret the result

The current implementation has no atomic global capacity reservation. `submitJob` calls `countActiveJobs`, decides between `queued` and `downloading`, then inserts the row in a separate operation. The unique index in `packages/db/src/schema/archive-ingest.ts` prevents duplicate active jobs for one owner and source key. It does not enforce the global concurrency limit for distinct sources.

A counterexample is a real code defect only if two independent calls can both observe the same remaining slot and both insert `downloading` jobs. Check the TLA+ action sequence against those awaits and status writes. Do not dismiss that trace as a model error unless an implementation guard or database constraint prevents the second admission.

## Keep the model current

When admission changes, update `ArchiveIngestCapacity.tla` to match its ordering and atomicity. Keep `ActiveWithinLimit` unchanged. Run both configs. The current implementation's non-atomic mode must produce a counterexample. The atomic-admission control must preserve the limit. If either result disagrees with the code, correct the model rather than weakening the invariant.

Coverage: `submitJob` capacity decision and job creation in `apps/backend/src/modules/series/internal/archive-ingest/services/job.ts`; statuses counted by `countActiveJobs` in `apps/backend/src/modules/series/internal/archive-ingest/repository.ts`; active-job uniqueness in `packages/db/src/schema/archive-ingest.ts`.

The model was synchronized with code at commit `6370a71614f41ff50b6621a7d6245576186ccdca`. That implementation violates the capacity invariant. Move the sync commit forward only after confirming the model still describes the code. Record a passing result only after an intended fix passes the atomic-admission check.
