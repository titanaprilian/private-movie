# Architecture Decision Log (ADR): Media Ingestion & S3/B2 Storage Resolution

> **Document Purpose**: Architectural reference and defense guidance for technical interviews, detailing the rationale for **zero-byte server playback delivery**, multi-provider storage abstraction (S3 / Backblaze B2 / MinIO), and the **resource-safe archive ingestion pipeline** in `@repo/media-service` and `apps/backend/`.

---

## 1. Executive Summary & Narrative Anchor

When asked in an interview: _"How does your media streaming platform deliver and ingest multi-gigabyte video files on a tiny 2GB VPS without crashing or exhausting resources?"_, your primary narrative should bridge **control-plane vs. data-plane separation with storage tiering**:

> *"We treat our backend strictly as a **lightweight control plane**, never as a video data relay for stored assets. When a client requests playback (`GET /api/episodes/:id`), the backend resolves the media asset and either issues a short-lived presigned URL or formats a public CDN URL. Video bytes, HTTP Range requests, and chunk streaming are completely offloaded to object storage (Backblaze B2, Cloudflare R2, or MinIO), resulting in **zero streaming bandwidth and zero memory overhead on our VPS**.
>
> *For media ingestion, we built an asynchronous archive ingestion pipeline designed specifically for storage-constrained environments (25GB SSD). Rather than decompressing entire multi-gigabyte archives at once—which would crash the disk—the pipeline runs a **sequential extract-stream-and-delete state machine**: it extracts one episode file, pipes it directly to S3 via multipart streaming, and immediately deletes the local file before extracting the next.
>
> _To support flexible hosting, we implemented a multi-provider registry where local MinIO serves as a zero-cost staging environment, while production seamlessly targets Cloudflare R2/Backblaze B2 with credentials protected by AES-256-GCM encryption at rest."_

---

## 2. Decision Matrix: Video Delivery & Ingestion Strategies

| Architectural Dimension      | Chosen Architecture                                                                         | Direct Server Streaming (Express/Node)                                           | Monolithic Worker Extraction                                             |
| :--------------------------- | :------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| **Playback Delivery**        | **Control Plane URL Signing / CDN Bypass** (`getPresignedPlaybackUrl`)                      | Backend proxies video files from disk/S3 using `fs.createReadStream().pipe(res)` | Backend pipes streams directly from internal worker processes            |
| **VPS Bandwidth Impact**     | **0 Mbps** (Client streams directly from S3/B2/CDN edge)                                    | **Double Bandwidth Tax** (Downloads from storage + uploads to client)            | High (Bandwidth consumed per concurrent stream)                          |
| **VPS RAM & CPU Impact**     | **Negligible** (~1KB JSON response per playback resolution)                                 | High (Active buffer allocation and socket maintenance per stream)                | High (Worker processes compete with backend for memory)                  |
| **Archive Ingestion (Disk)** | **Sequential Single-File Extract & Unlink** (Disk watermark never exceeds Archive + 1 File) | Extract-all to temporary disk (`7z x archive.zip`)                               | In-memory decompression (Streams archive directly through RAM)           |
| **Disk Exhaustion Risk**     | **Zero** (Guarded by preflight `statfs` 2.5x check + instant cleanup)                       | **Extreme** (10GB archive expands to 20GB, crashing 25GB SSD)                    | **Severe OOM** (Decompressing large archives in RAM triggers OOM killer) |
| **Storage Portability**      | **Dynamic Registry** (Local MinIO for Dev/Staging, B2/R2 for Production)                    | Hardcoded AWS S3 SDK credentials in `.env`                                       | Vendor-locked proprietary storage APIs                                   |

---

## 3. Deep Dive: The Core Defense Pillars

### Pillar 1: Separation of Control Plane and Data Plane (Playback Delivery)

#### The Architecture:

In `packages/media-service/src/internal/playback/normalization.ts`, when a user watches an episode, the backend resolves the video source:

```ts
// packages/media-service/src/internal/playback/normalization.ts
if (source.type === "s3") {
  const service = await options.storageProviderRegistry.getService(
    source.storageProviderId,
  );
  const publicBase = service.getPublicBaseUrl();

  if (publicBase) {
    // 1. Direct CDN Edge Delivery (Cloudflare R2 / Custom CDN Domain)
    url = `${publicBase}/${cleanKey}`;
  } else {
    // 2. Presigned S3/B2 Playback URL
    url = await service.getPresignedPlaybackUrl(url, expiresInSeconds);
  }
}
```

#### The Operational Reality:

- **The Naive Approach**: Many simple backends handle playback by streaming files through an API route (`GET /api/stream/:fileId` doing `createReadStream().pipe(res)`). For 100 concurrent 1080p viewers (each ~4 Mbps), the server must push **400 Mbps of continuous egress bandwidth** and manage hundreds of open sockets.
- **The Production Separation**: By returning presigned URLs or CDN links, the client’s video player (ExoPlayer on Android TV or HLS.js in the browser) communicates **directly with S3/B2 object storage**. The client issues standard HTTP Range requests (`Range: bytes=0-1048575`) directly to object storage.
- **VPS Resource Cost**: Exactly 0 MB RAM, 0% CPU, and 0 Mbps streaming bandwidth. The VPS only handles the initial ~1KB JSON metadata payload.

---

### Pillar 2: The Multi-Provider Storage Hierarchy (Local MinIO vs. Cloud B2/R2)

#### The Production Tradeoff:

- **The Dilemma**: What happens if the admin hosts everything—including MinIO object storage—on the local 2GB VPS?
  - Serving 100 concurrent video streams locally will throttle the 25GB SSD's IOPS, saturate the VPS network card, and expand MinIO's Go runtime memory from ~78MB to 400MB+.
- **The Solution: Storage Provider Abstraction (`storage_providers` table)**:
  - **Development & Staging Tier (Local MinIO)**: Co-located on the VPS. Ideal for zero-cost testing, local video uploads, and offline validation.
  - **Production Tier (Backblaze B2 / Cloudflare R2)**: With a single configuration toggle, the default active provider switches to an external cloud bucket configured with a `publicBaseUrl` (e.g., via Cloudflare Bandwidth Alliance for $0 egress fees).
  - **Observability Safeguard**: Our admin dashboard (`apps/backend/src/modules/dashboard/`) tracks storage capacity limits. For self-hosted MinIO setups, monitoring host CPU, RAM, and active connections provides clear operational telemetry on when to scale hardware or switch to cloud storage.

---

### Pillar 3: Resource-Safe Archive Ingestion Pipeline

#### The Reality:

- Admins frequently import media via multi-gigabyte compressed archives (`.zip`, `.rar`, `.7z`) containing complete seasons.
- The production VPS has a **2GB RAM limit and a 25GB SSD total disk capacity**.
- A naive extraction of a 10GB archive would attempt to write 15GB–20GB of uncompressed video files simultaneously, instantly filling the disk, locking PostgreSQL, and crashing the host.

#### The 4-Phase Ingestion State Machine:

```
[ Phase 1: Submit & Download ]
       │  • Verify disk preflight: statfs(stagingBaseDir) >= 2.5x archive size
       │  • Stream archive directly to staging SSD (zero in-memory buffering)
       ▼
[ Phase 2: Inspection & Listing ]
       │  • Run `7zz l -slt` to inspect table of contents in seconds
       │  • Zero files decompressed to disk yet; parse video metadata
       ▼
[ Phase 3: Human Mapping & Confirmation ]
       │  • Admin reviews file tree in dashboard, matches files to episode numbers
       │  • Admin deselects junk files (.txt, samples, unsupported formats)
       ▼
[ Phase 4: Sequential Extract -> Upload -> Delete Pipeline ]
       │  • Loop through confirmed selection ONE file at a time:
       │     1. 7zz extracts ONLY single target file (e.g., ep01.mp4, ~500MB)
       │     2. Stream directly to S3 via multipart upload (`@aws-sdk/lib-storage`)
       │     3. Record `video_sources` row in PostgreSQL
       │     4. IMMEDIATELY call `unlink(ep01.mp4)` to delete local file
       │     5. Mark item completed in database (resumable state)
       ▼
[ Complete & Purge ]
       └── Delete initial archive from staging SSD; job marked completed
```

#### Key Architectural Guarantees:

1. **Flat Disk Watermark**: The temporary disk space used never exceeds `Archive Size + 1 Episode File Size`.
2. **Zero Memory Buffering**: Disk files are converted into Web Streams (`Readable.toWeb(createReadStream(...))`) and fed into the AWS SDK multipart upload, consuming negligible RAM.
3. **Resumability & Idempotency**: Each file selection tracks `completed: true` and `videoSourceId`. If an upload blips on file 8 of 12, restarting the job skips already-uploaded files and resumes at file 8 without duplicate S3 writes.

---

### Pillar 4: Multi-Provider Credential Security (AES-256-GCM)

#### The Security Layer:

To support dynamic S3/B2 providers added via the admin dashboard without hardcoding keys in `.env`, credentials must reside in the database (`storage_providers`).

- **Threat Model**: A compromised database dump (`pg_dump`) or SQL injection read must never expose raw cloud credentials.
- **The Implementation (`packages/media-service/src/internal/s3/encryption.ts`)**:
  - All `accessKeyId` and `secretAccessKey` fields are encrypted at rest using **AES-256-GCM** (Authenticated Encryption with Associated Data).
  - Storage format: `iv:authTag:ciphertext` in hex encoding.
  - Every write uses a cryptographically secure 96-bit random IV and verifies a 128-bit authentication tag on read, preventing ciphertext tampering.
  - The `StorageProviderRegistry` decrypts keys into memory only when instantiating the S3 client and caches the client instances. Raw credentials are never returned over API endpoints.

---

## 4. Quick Interview Q&A Script (Cheat Sheet)

### Q: "How does your backend handle video streaming without choking its CPU, RAM, or bandwidth?"

> **Answer**: "We strictly decouple the control plane from the data plane. The backend never buffers or relays video bytes for stored media.
> When a client requests playback, the backend resolves the asset and returns either a short-lived presigned URL or a direct public CDN URL (e.g., Cloudflare R2 / Backblaze B2). The client player communicates directly with the object storage edge, issuing HTTP Range requests. This results in zero streaming bandwidth and zero memory usage on our VPS, allowing a 2GB server to easily support hundreds of concurrent viewers."

### Q: "What if an operator hosts both the backend and MinIO storage on the same small VPS?"

> **Answer**: "Running MinIO locally is our development and staging tier to keep operating costs at $0. However, for high-traffic production, serving 100 concurrent streams locally would saturate disk IOPS and network bandwidth.
> To solve this, we designed a multi-provider storage abstraction. In production, we switch the active provider to an external cloud bucket like Backblaze B2 or Cloudflare R2 behind a CDN. The backend code remains identical, but all heavy data egress is offloaded to distributed cloud edge infrastructure."

### Q: "How do you extract and ingest multi-gigabyte archives on a 25GB VPS without running out of disk space?"

> **Answer**: "Extracting a 10GB archive all at once would decompress 15GB–20GB of video files simultaneously and instantly crash our 25GB SSD.
> We built a 4-phase state machine that enforces a **sequential extract-stream-and-delete pipeline**:
>
> 1. Before downloading, it runs a `statfs` preflight check ensuring free disk space is at least 2.5x the archive size.
> 2. It inspects the archive's table of contents using `7zz list` without decompressing any files, letting the admin map episodes in the UI.
> 3. During execution, it extracts **one file at a time**, streams that single file directly to S3 via multipart upload, and **immediately calls `unlink()` to delete the local file** before extracting the next.
>    This guarantees our temporary disk watermark never exceeds the size of the archive plus a single episode."
