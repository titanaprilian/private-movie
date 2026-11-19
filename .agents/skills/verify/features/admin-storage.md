# Admin Storage

Admin Storage enables administrators to inspect storage provider status, monitor archive ingest jobs, view extraction progress, and audit worker concurrency capacity.

## Sub-features

- `admin-storage-overview`: view configured storage targets and disk utilization stats at `/admin/storage`.
- `admin-storage-ingest-queue`: inspect ongoing, pending, and completed archive ingest extraction jobs.
- `admin-storage-detail`: view series-specific storage allocations and unassigned video files at `/admin/storage/$seriesId`.

## How to get to it (user POV)

- Log in as admin at `/admin/login`.
- Select "Storage" from the admin sidebar navigation or navigate directly to `/admin/storage`.
- Click on an individual series storage row to inspect `/admin/storage/$seriesId`.

## Driving it with control.sh

Preconditions:

- Logged in with valid admin credentials.
- Backend running on `http://localhost:3000`.

- **Navigate to storage overview.** Go to `/admin/storage`.
- **Verify storage metrics.** Assert storage widgets or tables for connected disks and ingest jobs render.
- **Inspect ingest capacity.** Check archive ingest queue status (active jobs vs allowed concurrency limit).
- **Capture proof.** Capture screenshot to `artifacts/verify/admin-storage/overview.png`.

## Gotchas

- Ingest workers operate asynchronously via 7-Zip engines; ensure mock or test archive jobs do not exhaust disk space during repeated runs.
- Archive ingest admission enforces concurrency limits based on system core count and memory thresholds.
