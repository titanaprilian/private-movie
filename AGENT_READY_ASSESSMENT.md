# Agent-Ready Assessment: private-movie

## Codebase Snapshot: private-movie

- **Primary language/framework**: TypeScript (Bun, Elysia backend, Vite+React web) & Kotlin (Android TV)
- **Language tier**: statically-typed
  - Statically-typed: TypeScript, Go, Java, Scala, Rust, C#, Kotlin
  - Dynamically-typed: Ruby, Python (unannotated), JavaScript/Node.js, PHP
  - Gradually-typed: Python with mypy/Pydantic, TypeScript with strict:false
- **Commit count**: 825
- **Contributors**: 3
- **Source files**: 469
- **Test files**: 296 (ratio: 63.1%)
- **CI/CD**: GitHub Actions (`ci.yml`, `docker-publish.yml`)
- **Agent instructions**: AGENTS.md root canonical (47 lines) + scoped: apps/backend (112 lines), apps/web (28 lines), apps/android-tv (45 lines)
- **Domain context**: `docs/DOMAIN.md` present; ADRs in `docs/decision-log/` (3 ADRs: 01-bun-and-elysia, 02-drizzle-and-postgresql, 03-media-ingestion-and-s3-storage)
- **Linting config**: ESLint flat configs (apps/backend, apps/web), Prettier (root `prettier.config.js`), `./gradlew lint` (apps/android-tv); Husky hooks: pre-commit (commit-scope check + lint-staged), commit-msg (trailer check), pre-push (`bun run verify`)
- **Quality gates**: L3 — jscpd duplication (1.5% threshold) and knip dead-code/unused-exports (zero tolerance) both hard-fail in CI (`ci.yml` runs `bun run test:gate` + `bun run gate:check`); gate logic has unit tests (`test/unit/scripts/gate-check.test.ts`); identical local commands (`bun run gate:check`); gate scripts protected by CODEOWNERS; no baseline file by zero-tolerance design; cyclomatic/cognitive complexity NOT covered. (Recon heuristic suggested L1; overridden on evidence: the heuristic missed the hard-fail CI gate steps and gate tests.)
- **README**: present, 228 lines

---

## Overall Agent-Ready Score: 84/100

**Rating: Agent-Assisted**

This codebase is one point from Agent-Ready: machine-enforced module boundaries, a zero-tolerance structural debt gate, strict types, and enforced coverage thresholds mean agent output is cheap to verify. The remaining gaps — no e2e layer, mock-heavy unit tests, no complexity gate, and irreversible DB migrations — are the difference between "agents work well with oversight" and "agents work autonomously."

### Score Breakdown

| Dimension                 | Weight | Score  | Weighted          |
| ------------------------- | ------ | ------ | ----------------- |
| Type Safety               | 20%    | 88/100 | 17.6              |
| Test Foundation           | 15%    | 74/100 | 11.1              |
| Documentation & Context   | 15%    | 90/100 | 13.5              |
| Code Clarity              | 15%    | 80/100 | 12.0              |
| Architecture Clarity      | 15%    | 90/100 | 13.5              |
| Feedback Loops            | 10%    | 79/100 | 7.9               |
| Consistency & Conventions | 5%     | 92/100 | 4.6               |
| Change Safety             | 5%     | 77/100 | 3.9               |
| **TOTAL**                 | 100%   |        | **84.0 → 84/100** |

Delta vs. previous assessment (79/100): +5. Driven by Husky hooks, enforced coverage thresholds, the knip/jscpd gate, Trivy/Dependabot, and the new ARCHITECTURE.md / docs/DOMAIN.md.

---

## The Stripe Benchmark

Stripe's engineering team merged 1,000+ AI-generated pull requests in a single week. This is possible because Stripe's codebase satisfies what researchers call the **asymmetry of verification**: generating a PR is hard, but _verifying_ one — with fast CI, strict types, and comprehensive tests — takes minutes. Every dimension in this assessment measures how well your codebase satisfies that asymmetry.

The goal is to make agent output cheaply verifiable: the cost of a wrong answer is low, the feedback loop is fast, and the automated verification layer catches mistakes before humans need to. A score of 70+ means that condition is largely met. Below 50 means the verification infrastructure needs to be built before agents can work reliably.

---

## Quality Gate Maturity: L3

**Quality gates:** L3 — jscpd duplication (1.5% threshold) and knip dead-code/unused-exports (zero tolerance) both hard-fail in CI (`ci.yml` runs `bun run test:gate` + `bun run gate:check`); gate logic has unit tests (`test/unit/scripts/gate-check.test.ts`); identical local commands (`bun run gate:check`); gate scripts protected by CODEOWNERS; no baseline file by zero-tolerance design; cyclomatic/cognitive complexity NOT covered.

CI blocks all new duplication and dead code outright — with zero existing findings, the zero-tolerance stance is strictly stronger than a fingerprint baseline, and the commit-msg hook actively rejects baseline reintroduction. The uncovered property is cyclomatic/cognitive complexity, which no tool currently gates.

---

## Critical Findings

No dimension scored below 40. The weakest areas:

1. **Test Foundation (74/100)**: no e2e layer and 1,245 mock occurrences across 296 test files (~4.2 per file) — a meaningful fraction of coverage verifies mocked behavior, not real interactions.
2. **Change Safety (77/100)**: destructive irreversible migrations (`DROP TABLE ... CASCADE` in `0007`/`0013`, multiple `DROP COLUMN`) and zero feature flags — a bad agent change can only be reverted, and schema rollback means restore-from-backup.
3. **Complexity gate absent**: jscpd and knip are blocked at L3, but nothing prevents deeply nested logic from growing inside the 14 files already in the 500–1000 line range.

---

## Verification Cost Profile

> How expensive is it to confirm an agent's change is correct in this codebase?

| Signal                                                  | Status | What it means                                                                                                                                |
| ------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests run in < 10 min                                   | ✓      | Measured median 6m 32s on PRs (push to main is 12m 9s with deploy); see [`docs/ci-performance-baseline.md`](docs/ci-performance-baseline.md) |
| Security scanning automated                             | ✓      | Trivy fs scan blocks CI on CRITICAL; Dependabot configured                                                                                   |
| Property-based tests present                            | ✗      | Edge-case verification relies on manually authored assertions                                                                                |
| Reproducible dev state (seeds/factories)                | ✓      | Docker Compose Postgres 16 + `bun run db:seed`; isolated CI service container per run                                                        |
| Coverage reported on PRs                                | ✓      | Enforced in CI and posted as sticky PR coverage comment via `scripts/coverage-summary.ts` (#981)                                             |
| Structural debt gate blocks new/worsened findings (L3+) | ✓      | Zero-tolerance knip + jscpd hard-fail every PR; gate is unit-tested and CODEOWNERS-protected                                                 |

**Verification bottleneck:** CI PR pipeline time (measured median 6m 32s, dominated by the `ci` job at 5m 47s with cold cache; see [`docs/ci-performance-baseline.md`](docs/ci-performance-baseline.md)) caps agent iteration cycles, making a fast-lane split (<2.5 min) the top candidate for developer velocity.

---

## Improvement Roadmap

### Quick Wins (1-2 days each)

- **Merge coverage into the test pass**: run vitest with `--coverage` in the main `test` turbo task to eliminate the duplicate test execution in CI.
- **Add a complexity rule**: ESLint `complexity` or `sonarjs/cognitive-complexity` in `apps/backend`/`apps/web` configs, wired into the existing zero-tolerance `gate:check`.
- **Add `prettier --check` to CI**: closes the `--no-verify` formatting gap (hooks auto-format, but CI never verifies).
- **Add a docs-link check to CI** (e.g., `lychee` over `*.md`) — the doc graph is small, near-free.
- **Wire `openapi:check` into CI** so the committed spec can never drift from the Elysia schemas.
- **Split the two near-god files**: `useArchiveIngestSources.ts` (969) and `series/repository.ts` (948).
- **Document a migration-safety rule** in `packages/db`/backend AGENTS.md: additive-only columns; drops require a two-phase (deprecate → drop) pair.

### High-Value Investments (1-4 weeks each)

- **Add a minimal e2e smoke suite** (Playwright web + one happy-path API flow against the CI Postgres service) as `test:e2e` in turbo.
- **Split CI into fast/slow lanes**: typecheck + lint + unit (<5 min, required check) vs. integration + build + gate + Trivy.
- **Backfill 2–3 ADRs** for already-made consequential decisions (Deep Modules adoption, zero-tolerance gate policy) so future agents see rejected alternatives.
- **Introduce branded ID types** (`MediaId`, `SeriesId`, `EpisodeId`) in `packages/contracts`.
- **Add `docs/CONTEXT-MAP.md`** mapping each module's public seam to its consumers.
- **Introduce fast-check property tests** for media-scraper parsers and contracts.
- **Adopt reversible migration discipline** (or a drizzle-kit snapshot rollback runbook).

### Long-Term Architecture (Ongoing)

- **Reduce mock density**: convert the highest-value mock-heavy unit tests to integration tests against the real DB; consider Stryker on `packages/media-service` to measure oracle strength.
- **Introduce minimal env-based feature flags** for high-churn areas (media ingestion, videos UI).
- **Decompose the large Android Compose screens** (`PlayerScreen.kt` 818, `DetailScreen.kt` 634) and split the `apps/web` videos module before its seam erodes.

---

## Start Fixing: agent-ready

If Documentation & Context or Architecture Clarity scored below 60, the **agent-ready** companion plugin can close those gaps now. It scaffolds AGENTS.md, ARCHITECTURE.md, a progressive-disclosure `docs/` structure, supported domain workflows in `docs/DOMAIN.md`, and documentation link/topology checks. It creates `CONTEXT.md` and ADRs only when terms or decisions are actually resolved. Use its **migrate** mode to upgrade an older agent-ready scaffold.

It reads this assessment report and suggests which mode to run first based on your weakest dimensions.

Get it, with both install methods and how to run it: https://www.damiangalarza.com/agent-ready/

---

## Want Help Moving the Needle?

This assessment was built by [Damian Galarza](https://www.damiangalarza.com?utm_source=codebase-readiness&utm_medium=report&utm_campaign=codebase-readiness), who works with engineering teams on production AI — shipping the foundation, then staying on as needed.

**[What each dimension means and how to interpret your score →](https://www.damiangalarza.com/codebase-readiness/?utm_source=codebase-readiness&utm_medium=report&utm_campaign=codebase-readiness)**

If the score surfaced gaps to fix with a team, start with a [Foundation Sprint](https://www.damiangalarza.com/services/?utm_source=codebase-readiness&utm_medium=report&utm_campaign=codebase-readiness): two weeks to ship one foundation piece against the highest-leverage problem, with the option to continue on a Production AI retainer.

**[See how engagements work →](https://www.damiangalarza.com/services/?utm_source=codebase-readiness&utm_medium=report&utm_campaign=codebase-readiness)**

---

## Dimension Details

### Test Foundation & Feedback Loops

#### Test Foundation Assessment

**Score: 74/100**

##### Evidence

- Test-to-source file ratio: 296 test files / 469 source files = **63.1%**. Distribution: `apps/web/test/unit` (145), `apps/backend/test` (42 unit + 72 integration), `apps/android-tv/app/src/test` (52 Kotlin), `packages/media-service` (20), `packages/media-scraper` (9), `packages/contracts` (5), `packages/db` (2), root `test/unit` (1, gate test).
- Coverage configuration: **present** — Vitest + `@vitest/coverage-v8`; thresholds enforced: backend `lines 52 / functions 51 / branches 75`; web `lines 82 / functions 81 / branches 73` (`vitest.config.ts` per app).
- CI coverage enforcement: **yes** — `ci.yml` runs `turbo run test:coverage --continue` and `scripts/coverage-summary.ts`; failing thresholds fail the run. Reports uploaded as artifacts (14-day retention).
- Test pyramid: **unit + integration** (72 backend integration tests against a real Postgres 16 service container) + Android unit tests. **No e2e layer**.
- Flaky test signals: **0** commits mentioning flakiness/skipping; no retry plugins (backend uses `fileParallelism: false` to serialize DB tests deliberately).
- Mock/stub density: **high** — 1,245 `jest.mock|vi.mock|vi.fn|mock(` occurrences across 296 test files (≈4.2 per file).
- Property-based testing: **absent**. Mutation testing: **absent**.
- Skipped tests: 3 `.skip(`/`xit(` occurrences (~1%).

##### Strengths

- 63% test-to-source ratio with a real integration layer hitting Postgres service containers.
- Coverage thresholds enforced in CI per-app at meaningful levels.
- No flaky-test smell: zero flaky commits, no retry plugins, deterministic DB test serialization.
- Gate logic itself is tested and runs in CI.

##### Gaps

- No end-to-end layer: nothing exercises web → backend → DB as a user flow.
- Mock density (4.2x test files) means a substantial fraction of "coverage" verifies mocked behavior.
- No property-based or mutation testing.
- `packages/db` has only 2 unit tests despite owning schema/migrations.

##### Recommendations

- **Quick Wins**: Add a minimal e2e smoke suite (Playwright + one happy-path API flow); raise `packages/db` coverage.
- **High-Value Investments**: fast-check property tests for media-scraper parsers and contracts; audit top mock-heavy files and convert to integration tests; Stryker on `packages/media-service`.

---

#### Feedback Loops Assessment

**Score: 79/100**

##### Evidence

- CI platform: **GitHub Actions** (`ci.yml` 124 lines, `docker-publish.yml` 192 lines).
- Estimated pipeline time: **~10–15 min** — two parallel jobs (`ci`, `android`); the `ci` job serially runs `db:migrate`, `typecheck lint test test:integration build`, gate check, Trivy, and a separate full `test:coverage` pass — tests effectively run twice. No test sharding.
- Caching: **yes** — Turbo remote cache (`TURBO_TOKEN`/`TURBO_TEAM`), Gradle caching, Docker `type=gha` cache.
- Parallelization: **partial** — two CI jobs in parallel; turbo parallelizes within; no matrix/sharding.
- Fail-fast: **no** — turbo `--continue` collects all failures in one run (deliberate, agent-friendly trade-off).
- Pre-commit hooks: **present** — Husky pre-commit (scope check + lint-staged), commit-msg (trailer check), pre-push (`bun run verify`).
- Coverage reporting: **in CI** — summary script + artifact upload; **no PR-comment/delta reporting**.
- Security scanning: **present** — Trivy fs scan, `exit-code: 1`, CRITICAL, blocks CI. Dependabot configured.
- Ephemeral environments: **partial** — isolated Postgres 16 service container per CI run; no per-PR preview environments. (+3)
- Gate actionability: full-repo console dump; no inline PR annotations or merge-base scoping (zero-tolerance full-repo gate by design).
- Gate reproducibility: **identical local/CI command** (`bun run gate:check`, documented in AGENTS.md). (+3)
- Gate tests: **present** — `test/unit/scripts/gate-check.test.ts`, run in CI before the gate; gate scripts CODEOWNERS-protected. (+3)

##### Strengths

- Turbo remote caching across CI runs — the biggest monorepo speed lever already pulled.
- Pre-push `bun run verify` catches almost all CI failures locally.
- `--continue` returns all failures in one iteration — better agent ergonomics than fail-fast.
- Security (blocking Trivy) + Dependabot + coverage + structural gate = broad signal set per push.

##### Gaps

- Tests run twice per CI run (`test` then `test:coverage`) — clearest pipeline-time waste.
- No coverage delta/summary comment on PRs; agents must download artifacts.
- No per-PR ephemeral environment for live behavior validation.
- No sub-5-minute fast lane.

##### Recommendations

- **Quick Wins**: Merge coverage into the main test pass; post `coverage-summary.ts` output as a sticky PR comment.
- **High-Value Investments**: Split CI into a fast lane (<5 min required check) and slow lane; per-PR preview deployments via the existing Docker pipeline.

---

### Documentation & Context

#### Documentation Assessment

**Score: 90/100**

##### Evidence

- **Agent instructions**: Canonical root `AGENTS.md` (47 lines), no competing `CLAUDE.md`. Explicitly scoped: "this file holds only repo rules agents cannot discover from the code," process delegated to pstack skills. Links to `ARCHITECTURE.md` and `docs/DOMAIN.md` both resolve. Three scoped files with genuine local rules: `apps/backend` (112), `apps/web` (28), `apps/android-tv` (45). Root declares precedence ("on conflict, the app file wins"), echoed per app.
- **Agent-instruction content profile**: Root — 0% code-example lines, 8 sections, strong imperative voice ("**Never** run `db:push`", "never `--no-verify`"). Scoped files: 0 code lines; directives 20/5/2. No bloat, no tutorial drift.
- **ARCHITECTURE.md**: Present (95 lines) — monorepo topology with responsibility matrix, component/package inventories, three documented flows (contract-first API, media ingestion, playback), governance section, codemap diagrams in PNG/SVG/HTML.
- **Domain context**: `docs/DOMAIN.md` (89 lines) — canonical terminology, domain models, entity invariants, job lifecycle; single glossary authority. Supporting diagrams: `domain-context-map.*`, `ingest-lifecycle.*`.
- **ADRs**: 3 in `docs/decision-log/` — substantive (157–160 lines each), trade-off-focused with alternatives and consequences; all added 2026-11-14.
- **Topic docs**: None separate; testing/convention rules folded into AGENTS.md files (appropriate at this size). Rich diagram set under `docs/diagrams/`.
- **README**: 228 lines — stack, architecture link, project structure, full getting-started, testing, build/quality commands.
- **Documentation CI**: None.

##### Coherence

- **Topic overlap**: None of consequence. Root holds only non-discoverable rules and delegates via links; scoped files add platform-specific rules without restating root content.
- **Cross-document conflicts**: 0 detected. The module-seam rule is stated once at root and _mapped_, not redefined, per app.
- **Source of truth clarity**: `@repo/contracts` canonical for API shapes; DOMAIN.md single glossary; ADR 02 names Drizzle schema as DB source of truth.
- **Broken references**: 0.
- **Agent-instruction role**: Directive index.

##### Strengths

- Exemplary entrypoint discipline: 47-line canonical root of non-discoverable rules with explicit precedence across 4 files.
- Complete artifact coverage: codemap with flows and governance, single-authority glossary, substantive fresh ADRs, multi-format diagrams.
- High-value agent gotchas documented (Bun runner filter trap, `db:push` data-loss warning, never `--no-verify`).

##### Gaps

- No documentation verification in CI (link checking / markdown lint).
- ADR coverage thin (3 records for an 825-commit, 3-app monorepo); Deep Modules adoption and gate policy documented descriptively, not as decision records.

##### Recommendations

- **Quick Wins**: Add a docs-link check (`lychee`) to CI alongside the gate job.
- **High-Value Investments**: Backfill 2–3 ADRs for already-made decisions; split AGENTS.md sections into `docs/TESTING.md`/`docs/DEPLOYMENT.md` if any section approaches ~30 lines.

---

### Code Clarity & Consistency

#### Code Clarity Assessment

**Score: 80/100**

##### Evidence

- Average file size: 166 lines (947 source files incl. tests).
- Files over 500 lines (non-test): 14 — largest: `useArchiveIngestSources.ts` (969), `packages/media-service/src/internal/series/repository.ts` (948), `archive-ingest/services/job.ts` (849), `PlayerScreen.kt` (818), `VideoPlayer.tsx` (759).
- Files over 1000 lines (god files): **0 in production source** (only test files, e.g. `api.test.ts` 1931 — acceptable).
- Catch-all directories: `utils/` in 14 module-scoped locations (39 files, spread thin); `apps/backend/src/lib/` (7 files, all named); no catch-all exceeds 20 files.
- Directory depth: 4–6 levels encoding domain + visibility (`modules/<domain>/internal/<subdomain>/<layer>/`).
- Naming quality: excellent — paths reveal domain concepts and role; no vague `helpers.ts`/`misc.ts` hotspots.
- Structural gate coverage: complexity: **none** · duplication: **blocked** (jscpd 1.5%, hard-fails CI) · dead code: **blocked** (knip zero-tolerance, hard-fails CI) — Gate Level **L3**.

##### Strengths

- Modular architecture makes file purpose inferable from path; enforced by custom ESLint boundary rules.
- Zero god files in production source; typical file well under 200 lines.
- Duplication and dead code both blocked at L3 with identical local command.

##### Gaps

- No complexity check at all — nothing prevents the 969-line hook from growing further.
- 14 non-test files in the 500–1000 range, concentrated in exactly the files agents edit most.
- `utils/` directories are the natural accumulation point as the codebase grows.

##### Recommendations

- **Quick Wins**: Add ESLint `complexity`/`sonarjs/cognitive-complexity` wired into `gate:check`; split the two 900+ line files.
- **High-Value Investments**: Decompose large Android Compose screens; establish a convention for when `internal/utils/` content graduates to a named sibling directory.

---

#### Consistency & Conventions Assessment

**Score: 92/100**

##### Evidence

- Linter: ESLint flat configs (typescript-eslint type-aware) in backend/web — CI-enforced (`ci.yml:48`); Android via `./gradlew lint` (`ci.yml:114`).
- Formatter: Prettier (root config) auto-applied on commit via lint-staged; no `prettier --check` in CI.
- Pre-commit hooks: Husky — pre-commit (commit-scope gate + lint-staged ESLint `--fix`/Prettier `--write`), commit-msg (trailer gate, rejects baseline reintroduction), pre-push (`bun run verify`).
- Custom/architectural linters: **present** — `deep-modules/no-cross-module-internal-imports` (backend) and `no-restricted-imports` blocking `*/internal/**` (web), with teaching error messages; plus commit-scope gate script.
- Lint legacy-debt treatment: **cleared / zero-tolerance** — no baselines; commit-msg hook rejects `.knip-baseline.json`/`.jscpd-baseline.json` reintroduction; 75 `eslint-disable` in source + 6 in tests, 3 `@ts-expect-error` — under the 100-suppression threshold.

##### Strengths

- Lint and format fully automated with pre-commit auto-fix — agent code is normalized before commit.
- Custom architectural rules encode Deep Modules boundaries with error messages that teach the correct import.
- Zero-tolerance stance hardened at tooling level, not just convention.

##### Gaps

- Prettier not checked in CI — a `--no-verify` commit can land unformatted code.
- 75 inline `eslint-disable` sites function as scattered mini-baselines.
- Backend ESLint thin on style strictness (`no-unused-vars` warn, `no-console` off); Android lint posture not explicit in build config.

##### Recommendations

- **Quick Wins**: Add `prettier --check` to CI; audit the 75 disable sites and require reason comments.
- **High-Value Investments**: Promote `no-unused-vars` to error, consider typescript-eslint strict/stylistic presets; explicit `lint {}` block in `apps/android-tv/app/build.gradle.kts`.

---

### Type Safety, Architecture & Change Safety

#### Type Safety Assessment

**Score: 88/100**

##### Evidence

- Language: TypeScript 5 (Bun/Elysia, Vite+React) + Kotlin; TS majority (1,014 `.ts/.tsx` files).
- Strict mode: `"strict": true` in all workspace tsconfigs; web adds `noUnusedLocals` + `noUnusedParameters`.
- `any` usage: 99 matches across 1,014 TS files (~0.1 per file); only 3 `@ts-ignore`/`@ts-expect-error` repo-wide.
- Runtime validation: Elysia `t.Object` schemas colocated per module validating every HTTP boundary; Zod v4 in apps/web (16 usages).
- API contract types: `packages/contracts` shared typed package with generated OpenAPI artifact + `openapi:generate`/`openapi:check` (git-diff enforcement) scripts; no generated typed client for external consumers.
- Database invariants: 86 `notNull`/`unique`/`references`/`check` occurrences across 6 Drizzle schema files; 30 forward migrations. (+5)
- CI enforcement: `turbo run typecheck` required in CI; pre-push hook runs `bun run verify`.

##### Strengths

- Strict everywhere with near-zero escape hatches.
- Runtime validation at the HTTP boundary — the exact gap TS's erased types leave.
- Typecheck is a hard CI gate and pre-push hook, not advisory.
- DB constraints extend invariants below the application layer.

##### Gaps

- No generated typed client from the OpenAPI spec; spec is an artifact, not a consumed contract.
- Few branded/semantic domain types; IDs flow as primitives.
- Zod usage on web is thin (16 sites) relative to surface area.

##### Recommendations

- **Quick Wins**: Wire `openapi:check` into CI.
- **High-Value Investments**: Branded ID types (`MediaId`, `SeriesId`, `EpisodeId`) in `packages/contracts`; openapi-fetch client for non-monorepo consumers.

---

#### Architecture Clarity Assessment

**Score: 90/100**

##### Evidence

- Directory structure: domain-organized monorepo — `apps/{backend,web,android-tv}` + `packages/{contracts,db,media-service,media-scraper,config-vitest}` (Turborepo).
- Domain boundaries in filesystem: backend 9 feature modules, web 12, each with strict `index.ts` seam / `http.ts` adapter / `internal/` implementation.
- Domain grouping consistency: **0% root-level leakage** (backend modules: 91 files, 0 at root; web: 232, 0 at root).
- Service/domain layer: thin HTTP adapters, logic in `internal/.../services/` and `repository.ts`.
- God objects: none ≥1000 lines of business logic.
- Scoped agent instructions: 4 files, each with genuine local rules. (+5)
- Domain context: `docs/DOMAIN.md` + `ARCHITECTURE.md` + 3 ADRs; no CONTEXT-MAP.md.
- Cross-domain dependency explicitness: **enforced, not conventional** — ESLint `no-restricted-imports` in both apps forbids cross-module `internal/` imports.

##### Strengths

- Filesystem-faithful Deep Modules with 0% leakage and lint-enforced public seams — agents physically cannot cross boundaries without CI failing.
- Scoped AGENTS.md files give local rules where agents work.
- Contracts extracted to `packages/contracts`; dependencies explicit via package.json.

##### Gaps

- No CONTEXT-MAP.md mapping the ~21 modules' relationships.
- Web `videos` module becoming a hotspot (top churn, largest module tree).

##### Recommendations

- **Quick Wins**: Add `docs/CONTEXT-MAP.md` (one table: module → public seam → consumers).
- **High-Value Investments**: Split `apps/web/src/modules/videos` before the seam erodes.

---

#### Change Safety Assessment

**Score: 77/100**

##### Evidence

- Co-change coupling: low-moderate. Top pairs are bootstrap files (`app.ts ↔ index.ts`, 287) and within-module seams (`videos/index.ts ↔ internal/api.ts`, 182; `media/http.ts ↔ media/index.ts`, 180) — expected seam co-change, not cross-domain coupling.
- Highest-churn files: `media/http.ts` (102), `videos/internal/api.ts` (76), `packages/media-service/src/index.ts` (62). Churn concentrates in module seams, not shared dirs.
- Feature flags: **absent** (0 usages).
- Migration safety: mixed-to-weak. 30 forward-only Drizzle migrations with destructive operations (`0007` `DROP TABLE "videos" CASCADE`, `0013` `DROP TABLE series_relations CASCADE`, multiple `DROP COLUMN`); no down-path; rollback = restore from `private_movie_backup.sql`.
- Module boundaries: **enforced** via ESLint + contracts package; violations fail lint in CI.
- Rollback capability: manual (git revert + Docker republish); no blue/green or flag kill switch.
- Debt guard: **zero-tolerance blocking (L3-equivalent semantics)** — knip findings and jscpd >1.5% hard-fail CI; identical local command; gate unit-tested; no `continue-on-error` anywhere; no regenerable baseline exists to silence it. (+5)
- Baseline governance: N/A by design (zero tolerance; nothing to regenerate).

##### Strengths

- Zero-tolerance structural gate blocks every PR — stricter than most L3 fingerprint setups.
- Machine-enforced module boundaries; co-change confirms changes stay inside seams.
- Gate logic is unit-tested — the safety net can't silently rot.

##### Gaps

- No feature flags — every change ships on merge; bad changes can only be reverted.
- Destructive irreversible migrations; DB rollback is restore-from-backup.
- Gate evaluates the whole tree (green main is a hard invariant — acceptable at zero tolerance).

##### Recommendations

- **Quick Wins**: Document a migration-safety rule: additive-only columns; drops require two-phase (deprecate → drop) pairs.
- **High-Value Investments**: Minimal env-based feature flags for high-churn areas; reversible migration discipline or a drizzle-kit snapshot rollback runbook.

---

## What "Agent-Ready" Means

AI agent work doesn't eliminate verification — it relocates it. Before agents, developers split time between writing, reading, and checking code. With agents, writing is offloaded. But every line an agent produces still needs to be verified against human intent, either by automated systems or by humans reading code.

An agent-ready codebase maximizes automated verification and minimizes the cost per change:

- **Tests are the oracle** — when an agent makes a change, the test suite tells it immediately whether that change matches intent. Without tests, every agent change requires a human to read and reason about correctness manually — which destroys scalability. A noisy oracle (flaky tests, heavily mocked suites) is nearly as bad as no tests.
- **Type systems reduce verifier noise** — a type-checked build that passes is a higher-confidence signal than an untyped build that passes. Types convert silent runtime failures into loud compile-time failures, so agent mistakes are caught before a human ever reviews them.
- **Documentation makes intent verifiable:** the canonical agent instruction entrypoint, domain context, and consequential ADRs give agents the context to produce changes that match business intent, not just syntactic correctness. Without documented intent, an agent's change can pass every automated check and still be wrong in ways only a human reviewer can catch.
- **Small files bound the verification surface** — when a change is contained to one focused file, a test failure is attributable and precise. Large files and high coupling produce noisy feedback: a failure could be caused by any of a dozen interacting concerns.
- **Fast feedback enables iteration** — a 45-minute CI pipeline limits agents to ~10 verification cycles per day. A 5-minute pipeline enables ~100. Pipeline speed is a structural prerequisite for agent work at scale, not a convenience.
- **Security and vulnerability scanning extends coverage** — functional tests verify behavior; security scanners verify a different correctness dimension that agents can silently violate.

Each point in the Improvement Roadmap raises the verification limit — reducing manual review burden while increasing confidence in every agent-produced change.

---

_Generated by codebase-readiness skill — agent-skills_
