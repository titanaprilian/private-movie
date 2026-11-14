# Architecture Decision Log (ADR): Backend Runtime & Framework

> **Document Purpose**: Architectural reference and defense guidance for technical interviews, detailing the rationale for selecting **Bun + Elysia** over **Node.js + Express / NestJS** in `apps/backend/`.

---

## 1. Executive Summary & Narrative Anchor

When asked in an interview: _"Why did you choose Bun + Elysia over Node.js + Express or NestJS?"_, your primary narrative should bridge **genuine engineering curiosity with grounded production validation**:

> _"My initial motivation was to evaluate Bun and Elysia on a non-trivial, real-world application rather than a toy benchmark. However, as the system evolved into a full media streaming platform running on a budget-constrained VPS, that choice proved to be an architectural win across three pillars:_
>
> 1. _**Predictable Memory Footprint**_: _Our core backend process runs at ~120MB RSS, leaving crucial headroom on a 2GB VPS shared with Postgres, MinIO, and a headless Chromium scraper._
> 2. _**Native Web Streams for Media Proxying**_: _Native Web Standards (`fetch`, `Request`, `Response`, `ReadableStream`) allowed us to implement zero-adapter video segment relaying in 5 lines of code without Node stream bridging._
> 3. _**Built-in 'tRPC' Experience with Eden Treaty**_: _Full compile-time type safety across backend and web frontend without build-time codegen or OpenAPI schema drift, while still exposing standard REST/OpenAPI to our Android TV client._
>
> _To de-risk using a modern runtime, we strictly decoupled domain logic into protocol-agnostic Deep Modules, meaning our core business code has zero framework lock-in."_

---

## 2. Decision Matrix: Bun + Elysia vs. Alternatives

| Architectural Dimension       | Bun + Elysia (Chosen)                                                                          | Node.js + Express                                                           | Node.js + NestJS                                                       |
| :---------------------------- | :--------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| **Idle Memory (Process RSS)** | **~25–35MB baseline** (~120MB with full DB pools, Sentry & Schedulers)                         | ~60–80MB baseline                                                           | **150–250MB+ baseline** (bloated by reflection metadata & DI tree)     |
| **Media & Video Streaming**   | **Native Web Streams** (`Response(targetStream)` zero-copy pass-through)                       | Legacy Node streams (`stream.Readable.fromWeb().pipe(res)`)                 | Layered controller abstraction over Express/Fastify adapters           |
| **Type Safety & RPC**         | **Built-in Eden Treaty** (Compile-time inference directly from route schema; no codegen)       | None out-of-the-box (Requires manual Zod glue, tRPC, or OpenAPI generators) | Decorator-based typing (`class-validator`), runtime DTO reflection     |
| **Multi-Client Strategy**     | **Hybrid**: Eden Treaty for Web + auto-generated OpenAPI/REST for Android TV                   | Manual swagger generation + untyped REST                                    | `@nestjs/swagger` annotations on every controller/DTO                  |
| **Architecture & DI**         | **Deep Modules** via functional composition (`createApp(deps)`)                                | Unstructured by default (High risk of spaghetti without strict discipline)  | Rigid Angular-style OOP (`@Module`, `@Injectable`, `reflect-metadata`) |
| **Developer Velocity**        | **Zero-config native TypeScript**, instant hot reloading (`bun --watch`), built-in hash/crypto | Requires `ts-node`/`tsx`, `nodemon`, `tsconfig` transpilation setup         | Heavy boilerplate, compile cycles, slow startup during development     |

---

## 3. Deep Dive: The Core Defense Pillars

### Pillar 1: Lean Resource Utilization on Constrained Hardware

#### The Reality:

- The production environment runs on a **2GB RAM VPS**.
- The server co-locates multiple infrastructure services:
  - **Postgres Database (`private-movie-db`)**: ~100MB RAM
  - **MinIO Object Storage (`private-movie-minio`)**: ~80MB RAM
  - **Caddy Reverse Proxy**: ~25MB RAM
  - **Headless Chromium (`playwright`)**: ~135MB RAM (essential for scraping embed video sources in `@repo/media-scraper`)
- **Total Host Ceiling**: 2,000MB.

#### The Architecture Tradeoff:

- **The NestJS Risk**: NestJS uses `reflect-metadata` to analyze decorators at boot. It builds a massive in-memory graph of providers, classes, and scopes. On Node's V8 engine, a typical NestJS application idles at 150MB–200MB and quickly expands under load. Combining NestJS with headless Chromium and Postgres on a 2GB node would push memory dangerously close to hardware limits and trigger Linux OOM kills.
- **The Bun + Elysia Reality**: Bun's runtime engine (JavaScriptCore) and Elysia's compiled route handlers provide a remarkably flat memory profile. The entire backend process—including database connection pools, Sentry telemetry, and background schedulers—runs comfortably at **~120MB RSS**.

---

### Pillar 2: Native Web Streams & Simplified Media Proxying

#### The Reality:

- The `media` module (`apps/backend/src/modules/media/internal/proxy/routes.ts`) intercepts, sanitizes, and streams HLS video chunks (`.m4s`, `.ts`) and embed documents from external sources.

#### The Architecture Tradeoff:

- **In Node.js (Express / Fastify)**:
  Node HTTP servers are fundamentally built on legacy `http.IncomingMessage`, `http.ServerResponse`, and `EventEmitter`-based `stream.Readable`. When calling modern `fetch()` in Node, you receive a Web `ReadableStream`. To pipe this back to the client in Express:
  ```ts
  // Node / Express legacy bridge:
  const fetchRes = await fetch(targetUrl);
  const nodeReadable = stream.Readable.fromWeb(fetchRes.body);
  nodeReadable.pipe(res);
  ```
  This creates an adapter tax: constant stream translation, intermediate buffer allocations, and manual cleanup on client disconnect (`req.on('close', ...)`).
- **In Bun + Elysia**:
  Web Standards are native first-class citizens in Bun's core (written in Zig):
  ```ts
  // Elysia proxy route (Direct Web Standards):
  const targetResponse = await fetch(targetUrl, { ... });
  return new Response(targetResponse.body, {
    status: 200,
    headers: responseHeaders,
  });
  ```
  Bun pipes the upstream `ReadableStream` directly to the client socket with zero stream-adapter bridging, optimal backpressure handling, and clean garbage collection under continuous video segment relaying.

---

### Pillar 3: Eden Treaty — Built-in "tRPC" Without Codegen Drift

#### The Reality:

- The system serves two primary clients:
  1. **Web App (`apps/web`)**: React + TanStack Router (TypeScript).
  2. **Android TV App (`apps/android-tv`)**: Native Kotlin.

#### The Architecture Tradeoff:

- **Why not plain Express?**
  Express routes are untyped by default. Frontend and backend contract synchronization requires manual discipline or complex third-party setups (like `openapi-typescript` generators that require a build step to stay in sync).
- **Why not tRPC?**
  tRPC provides phenomenal type safety between TypeScript backends and frontends, but it locks the backend into a TS-only protocol. Building a native mobile client (Android TV in Kotlin) against tRPC is clunky and unnatural.
- **The Elysia Solution**:
  Elysia defines routes using **TypeBox schemas** (`apps/backend/src/modules/*/schemas.ts`):
  1. **For React (`apps/web`)**: `@elysiajs/eden` consumes `type App` directly from `@repo/backend`. Changing a route parameter or response shape in the backend causes an immediate compile error in the frontend. It delivers a **tRPC-like developer experience out-of-the-box with zero build-time codegen**.
  2. **For Android TV (`apps/android-tv`)**: Elysia's routes remain standard, clean HTTP REST endpoints. Elysia auto-generates OpenAPI specs (`@elysiajs/openapi`), and the monorepo maintains canonical DTOs in `packages/contracts`. Both web and native mobile are first-class citizens.

---

### Pillar 4: De-risking Bun via Deep Modules & Decoupling

#### The Interview Challenge:

> _"Isn't Bun too young or risky for production backend systems?"_

#### The Defense:

We acknowledged runtime youth upfront and designed our architecture to minimize framework lock-in:

1. **Protocol-Agnostic Domain Logic (`internal/`)**:
   Under the **Deep Modules** protocol (`apps/backend/AGENTS.md`):
   - All business logic, orchestration, and queries live in `src/modules/<feature>/internal/`.
   - Domain services have **zero awareness of Elysia, HTTP contexts, or Bun APIs**.
   - Elysia is treated purely as a thin transport adapter (`http.ts`). If Bun or Elysia were ever abandoned, 95% of our codebase (services, repositories, Drizzle queries) could be migrated to Fastify or Express simply by replacing the transport files.
2. **Deterministic CI & Test Execution with Node**:
   While development and production run on Bun, backend unit and integration tests run via **Vitest under Node.js** (`package.json: "test": "node --env-file=.env.test ./node_modules/.bin/vitest run"`). This ensures test runs rely on mature, battle-tested V8 Node primitives without test-runner inconsistencies.
3. **OS-Level Isolation for Heavy Operations**:
   For demanding tasks like archive extraction (7-Zip in `archive-ingest`), the backend delegates directly to operating system child processes (`7zz`/`7z`) rather than relying on experimental in-process JS libraries.

---

## 4. Quick Interview Q&A Script (Cheat Sheet)

### Q: "Why not NestJS? Isn't it the standard for structured TypeScript backends?"

> **Answer**: "NestJS enforces structure, but it achieves it via heavy Angular-style OOP, runtime decorators, and `reflect-metadata`. That brings two penalties:
>
> 1. It bloats idle memory to 150MB–200MB+, which is a severe operational liability on a 2GB VPS co-hosting Postgres, MinIO, and headless Chromium.
> 2. It tightly couples services to Nest's IoC container.
>    In our codebase, we enforced the exact same architectural boundaries using the **Deep Modules** pattern with a functional composition factory (`createApp(deps)`). We get strict domain isolation, explicit dependency injection, and instant test mocking at compile time with zero runtime reflection and an idle footprint of only ~120MB."

### Q: "Node has fetch and streams now too. Why did Bun matter for your media proxy?"

> **Answer**: "Node added `fetch` via Undici, but its core HTTP server still speaks legacy `http.IncomingMessage` and Node `stream.Readable`. Proxying video chunks in Express requires importing adapter helpers to bridge Web Streams to Node streams, which creates intermediate buffer allocations and backpressure plumbing.
> Bun was built from day one on Web Standards in native Zig. In Elysia, our route receives a Web `Request` and returns `new Response(targetResponse.body)`. The proxy is 5 lines of code, runs zero-adapter stream relaying at native speed, and handles connection teardown cleanly."

### Q: "Why Elysia over Express?"

> **Answer**: "Express gives you micro-framework simplicity, but leaves you in an untyped wild west where frontend and backend easily drift out of sync.
> Elysia gives us the simplicity and speed of Express, but with **built-in Eden Treaty**. Our React frontend imports `type App` and gets full autocomplete and compile-time error checking just like tRPC, without running code generators. And because Elysia routes are standard REST with TypeBox schemas, our native Android TV client still gets clean REST endpoints and OpenAPI specs."

### Q: "In your media proxy, what happens when hundreds of users watch videos simultaneously? Doesn't relaying streams choke your backend?"

> **Answer**: "Because we use Bun's native `ReadableStream`, CPU and RAM overhead on the server is negligible—it's zero-copy stream pass-through without video transcoding or heavy in-memory buffering.
>
> However, as an engineering reality, a centralized relay does not scale infinitely due to **network egress bandwidth and upstream rate limits** (every video stream has to be downloaded and uploaded through our VPS, doubling bandwidth usage, and third-party hosts see all traffic originating from a single IP).
>
> In an MVP, this centralized proxy is necessary to bypass CORS, rewrite referers, and strip aggressive popup ads. But if we scaled this to high concurrency, we would evolve it in two phases:
>
> 1. **Cache immutable video segments**: HLS `.ts` chunks are static files. Adding edge caching (Cloudflare or Nginx reverse proxy cache with `max-age=86400`) means repeated chunk requests never touch the upstream provider or backend origin.
> 2. **Offload proxying to Edge Workers**: Move the proxy logic to Cloudflare Workers or Fastly to distribute outbound bandwidth globally and eliminate single-datacenter IP throttling."
