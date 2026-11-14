# Agent-Ready Assessment: private-movie

## Codebase Snapshot: private-movie

- **Primary language/framework**: TypeScript (Bun, Elysia, React/Next.js) & Kotlin (Android TV)
- **Language tier**: statically-typed
  - Statically-typed: TypeScript, Go, Java, Scala, Rust, C#, Kotlin
  - Dynamically-typed: Ruby, Python (unannotated), JavaScript/Node.js, PHP
  - Gradually-typed: Python with mypy/Pydantic, TypeScript with strict:false
- **Commit count**: 768
- **Contributors**: 2
- **Source files**: 464
- **Test files**: 288 (ratio: 62.1%)
- **CI/CD**: GitHub Actions (ci.yml, docker-publish.yml)
- **Agent instructions**: AGENTS.md present (root canonical: 139 lines; scoped: apps/backend 112 lines, apps/web 62 lines, apps/android-tv 45 lines)
- **Domain context**: docs/decision-log/ (3 ADRs: 01-bun-and-elysia.md, 02-drizzle-and-postgresql.md, 03-media-ingestion-and-s3-storage.md), docs/specs/ (1 spec); CONTEXT.md absent
- **Linting config**: ESLint (apps/backend, apps/web), Prettier (root prettier.config.js), ./gradlew lint (apps/android-tv)
- **Quality gates**: Suggested Gate Maturity Level: L0 -- no complexity, duplication, or dead-code tooling detected
- **README**: present, 223 lines

---

## Overall Agent-Ready Score: 79/100
**Rating: Agent-Assisted**

This codebase provides exceptional architectural isolation through Deep Modules and a robust contract-first type system that prevents cross-boundary drift. Agents can operate with high autonomy on well-tested features, but the absence of pre-commit hooks, automated coverage reporting, and regression-aware quality gates requires human vigilance around structural code bloat and test mocking density.

### Score Breakdown

| Dimension | Weight | Score | Weighted |
|---|---|---|---|
| Type Safety | 20% | 95/100 | 19.0 |
| Test Foundation | 15% | 80/100 | 12.0 |
| Documentation & Context | 15% | 75/100 | 11.3 |
| Code Clarity | 15% | 70/100 | 10.5 |
| Architecture Clarity | 15% | 90/100 | 13.5 |
| Feedback Loops | 10% | 58/100 | 5.8 |
| Consistency & Conventions | 5% | 65/100 | 3.3 |
| Change Safety | 5% | 68/100 | 3.4 |
| **TOTAL** | **100%** | | **78.8 → 79/100** |

---

## The Stripe Benchmark

Stripe's engineering team merged 1,000+ AI-generated pull requests in a single week. This is possible because Stripe's codebase satisfies what researchers call the **asymmetry of verification**: generating a PR is hard, but *verifying* one — with fast CI, strict types, and comprehensive tests — takes minutes. Every dimension in this assessment measures how well your codebase satisfies that asymmetry.

The goal is to make agent output cheaply verifiable: the cost of a wrong answer is low, the feedback loop is fast, and the automated verification layer catches mistakes before humans need to. A score of 70+ means that condition is largely met. Below 50 means the verification infrastructure needs to be built before agents can work reliably.

---

## Quality Gate Maturity: L0

**Quality gates:** Suggested Gate Maturity Level: L0 -- no complexity, duplication, or dead-code tooling detected

Currently, there are no automated gates blocking cyclomatic/cognitive complexity, code duplication (`jscpd`), or dead code / unused exports (`knip`). Without regression-aware quality gates (L3+), agents can introduce bloated helper functions, duplicated logic across slices, or dead dependencies without CI objection.

---

## Critical Findings

No individual dimension scored below 40. However, the weakest areas requiring attention are:
1. **Feedback Loops (58/100)**: Absence of pre-commit hooks (Husky / lint-staged) and security scanning in CI means agent syntax or type issues only surface after pushing to remote CI.
2. **Quality Gates (L0)**: No structural gate enforcement exists to stop accumulation of complexity or unused exports.
3. **High Mock Density in Tests (1,377 mock/spy instances)**: An average of 4.78 mocks per test file increases oracle risk where mock-heavy unit tests pass despite broken integration contracts.

---

## Verification Cost Profile

> How expensive is it to confirm an agent's change is correct in this codebase?

| Signal | Status | What it means |
|---|---|---|
| Tests run in < 10 min | ✓ | Fast verification via Turborepo caching + parallel CI jobs (~3-5 min) |
| Security scanning automated | ✗ | Non-functional vulnerabilities require manual review |
| Property-based tests present | ✗ | Edge-case verification relies on manually authored assertions |
| Reproducible dev state (seeds/factories) | ✓ | Docker Compose (`postgres:16`) and `bun run db:seed` enable verifiable local state |
| Coverage reported on PRs | ✗ | Test regression signal is absent from GitHub PR summaries |
| Structural debt gate blocks new/worsened findings (L3+) | ✗ | Complexity, duplication, and dead code can silently grow under agent PRs |

**Verification bottleneck:** The lack of automated PR coverage reporting and lack of structural quality gates (complexity / dead-code checking) means human reviewers must manually audit PR diffs for structural bloat and test coverage gaps.

---

## Improvement Roadmap

### Quick Wins (1-2 days each)
- **Install Husky & lint-staged**: Run `turbo run typecheck lint` and `prettier --check` on git pre-commit to catch issues locally before remote CI.
- **Enable Vitest Coverage**: Add `@vitest/coverage-v8` in `packages/config-vitest/vitest.base.ts` with baseline thresholds (e.g., 70% lines/branches) in CI.
- **Decompose the 2 God Files**: Split `apps/web/src/modules/videos/internal/api.ts` (1,750 lines) and `apps/backend/src/modules/storage/internal/services/service.ts` (1,068 lines) into smaller single-responsibility services.

### High-Value Investments (1-4 weeks each)
- **Add Structural Quality Gates (L3)**: Configure `knip` (dead code / unused exports) and `jscpd` or ESLint `complexity` / `sonarjs/cognitive-complexity` with a baseline file so new complexity is blocked in CI.
- **Add Automated Dependency & Security Audits**: Add `dependabot.yml` and a Trivy or npm audit step in `ci.yml`.
- **Formalize `docs/DOMAIN.md` / `CONTEXT-MAP.md`**: Create a canonical business domain glossary and context map defining the boundaries between Series, Ingestion, Transcoding, Storage Providers, and Streaming playback.

### Long-Term Architecture (Ongoing)
- **Reduce Mock Density**: Transition mock-heavy unit tests toward contract-based verification against containerized dependencies or in-memory fixtures.
- **Introduce Property-Based Testing**: Incorporate `fast-check` for media parsing, URL extraction, and archive decompression routines.

---

## Start Fixing: agent-ready

If Documentation & Context or Architecture Clarity scored below 60, the **agent-ready** companion plugin can close those gaps now. It scaffolds AGENTS.md, ARCHITECTURE.md, a progressive-disclosure `docs/` structure, supported domain workflows in `docs/DOMAIN.md`, and documentation link/topology checks. It creates `CONTEXT.md` and ADRs only when terms or decisions are actually resolved. Use its **migrate** mode to upgrade an older agent-ready scaffold.

Get it: https://www.damiangalarza.com/agent-ready/

Since the Gate Maturity Level is **L0**, running `agent-ready` in **quality-gates** mode will install a regression-aware gate (`report` / `check` / `baseline` commands on native tools, merge-base-aware CI, a human-reviewed baseline, and gate tests) so existing code remains untouched while newly introduced complexity and dead code are blocked.

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
**Score: 80/100**

##### Evidence
- **Test-to-source file ratio**: 288 test files / 464 source files = 62.1% (Score band 81-100 baseline: 85).
- **Coverage configuration**: Absent. Neither Vitest base config nor package configs enforce a coverage threshold.
- **CI coverage enforcement**: No.
- **Test pyramid**: Unit + Integration layers. Real PostgreSQL 16 container runs in CI for backend integration tests (`apps/backend/test/integration/`).
- **Flaky test signals**: 0 commits in git history mentioning flakiness or skipped tests.
- **Skipped tests**: 0 tests skipped.
- **Mock/stub density**: 1,377 instances (`vi.fn` + `vi.mock`) across 288 test files (4.78x test file count). Exceeds 3x test file count (-5 modifier).
- **Property-based testing**: None found (+0).
- **Mutation testing**: None found (+0).

##### Strengths
- High test file coverage across both backend and web workspaces.
- Real integration test suite executed against live PostgreSQL in CI.
- Clean test run history with zero flaky test suppressions.

##### Gaps
- No coverage tracking or minimum coverage threshold in CI.
- Heavy reliance on mocking external dependencies in unit tests.

##### Recommendations
- **Quick Wins**: Configure `@vitest/coverage-v8` in `packages/config-vitest/vitest.base.ts`.
- **High-Value Investments**: Introduce property testing (`fast-check`) for archive decompression and URL extraction algorithms.

---

#### Feedback Loops Assessment
**Score: 58/100**

##### Evidence
- **CI platform**: GitHub Actions (`.github/workflows/ci.yml`).
- **Estimated pipeline time**: ~3–5 minutes due to Turborepo remote caching and parallelized execution.
- **Caching**: Yes (`setup-bun`, `setup-gradle@v4`, Turbo remote cache tokens).
- **Parallelization**: Yes. `ci` job and `android` job execute concurrently.
- **Fail-fast**: Yes (`--continue` used for step aggregation, but overall job status fails fast on error).
- **Pre-commit hooks**: Absent (no Husky or Lefthook).
- **Non-functional verification**: No automated SAST/security scanning or coverage reports.
- **Ephemeral environments**: Docker Compose present (`docker-compose.yml`, `.env.docker`) for reproducible local state (+3 modifier).
- **Quality gate ergonomics**: L0 (no structural tooling).

##### Strengths
- Fast CI pipeline leveraging Bun, Turbo cache, and Gradle caching.
- Isolated containerized PostgreSQL service container in CI.

##### Gaps
- Lack of pre-commit hooks allows broken formatting/types to be pushed to remote.
- No automated dependency or vulnerability auditing.

##### Recommendations
- **Quick Wins**: Setup Husky with `bun run format` and `bun run typecheck` on pre-commit.
- **High-Value Investments**: Add GitHub Dependabot or Renovate for automated vulnerability scanning.

---

### Documentation & Context

#### Documentation Assessment
**Score: 75/100**

##### Evidence
- **Agent instructions**: Canonical root `AGENTS.md` (139 lines), plus 3 app-scoped instruction files:
  - `apps/backend/AGENTS.md` (112 lines)
  - `apps/web/AGENTS.md` (62 lines)
  - `apps/android-tv/AGENTS.md` (45 lines)
- **Agent-instruction content profile**: High directive density (18 keywords: "must", "never", "always"), 0% code blocks in root instruction file, strict worktree isolation protocol.
- **ARCHITECTURE.md**: Absent. Architectural concepts are documented inside `AGENTS.md` and ADRs.
- **Domain context**: `docs/decision-log/` contains 3 recent, highly consequential ADRs (`01-bun-and-elysia.md`, `02-drizzle-and-postgresql.md`, `03-media-ingestion-and-s3-storage.md`). `CONTEXT.md` and `DOMAIN.md` are absent.
- **ADRs**: 3 ADRs (+5 modifier).
- **Topic docs**: `docs/specs/2026-10-06-archive-ingest-agnostic-downloads.md`.
- **README**: Present and informative (223 lines) with monorepo setup guides.
- **Documentation CI**: None.

##### Coherence
- **Topic overlap**: None. Scoped AGENTS.md files contain strictly app-specific nuances.
- **Cross-document conflicts**: None detected.
- **Source of truth clarity**: Clear hierarchy defined in root `AGENTS.md`.
- **Agent-instruction role**: Disciplined directive index.

##### Strengths
- Exceptional AGENTS.md discipline with mandatory worktree isolation and explicit TDD loop instructions.
- Well-written ADRs capturing core architectural decisions.

##### Gaps
- Lack of standalone `ARCHITECTURE.md` codemap and `docs/DOMAIN.md` glossary.

##### Recommendations
- **Quick Wins**: Create `ARCHITECTURE.md` with a high-level codemap linking apps and packages.
- **High-Value Investments**: Document domain entity relationships in `docs/DOMAIN.md`.

---

### Code Clarity & Consistency

#### Code Clarity Assessment
**Score: 70/100**

##### Evidence
- **Average file size**: ~238 lines across all files (~140 lines when excluding dist).
- **Files over 500 lines**: ~13 files.
- **Files over 1000 lines (god files)**: 2 source files:
  - `apps/web/src/modules/videos/internal/api.ts` (1,750 lines)
  - `apps/backend/src/modules/storage/internal/services/service.ts` (1,068 lines)
- **Catch-all directories**: `utils/` across packages contains 57 files (-5 modifier).
- **Naming quality**: Strong. Clear domain-oriented names in accordance with Deep Modules conventions.
- **Structural gate coverage**: Complexity: none, Duplication: none, Dead code: none (Level L0).

##### Strengths
- Deep Modules architecture enforces clean separation between module public entry points and internal implementation details.
- Most modules are compact and well below 300 lines.

##### Gaps
- Two oversized files exceed 1,000 lines.
- Catch-all `utils/` directory usage in several packages.
- Zero automated structural gates in CI.

##### Recommendations
- **Quick Wins**: Refactor `apps/web/src/modules/videos/internal/api.ts` into individual endpoint client files.
- **High-Value Investments**: Implement `knip` in CI to detect unused exports and dependencies.

---

#### Consistency & Conventions Assessment
**Score: 65/100**

##### Evidence
- **Linter**: ESLint in `apps/backend` and `apps/web`, `./gradlew lint` in `apps/android-tv`. Enforced in CI via `turbo run lint`.
- **Formatter**: Prettier configured at monorepo root (`prettier.config.js`).
- **Pre-commit hooks**: Absent.
- **CI enforcement**: Linting and formatting checked in CI.
- **Custom/architectural linters**: Deep module boundaries enforced via project convention and directory structure.
- **Lint legacy-debt treatment**: 86 inline suppressions across the repository, no baseline file.

##### Strengths
- Unified formatting and linting scripts run across the monorepo via Turborepo.
- Clean ESLint configuration without massive override lists.

##### Gaps
- Formatting and linting checks only execute in CI, not on commit.
- 86 inline suppressions scattered across the codebase.

##### Recommendations
- **Quick Wins**: Add `format` check to CI and pre-commit hooks.
- **High-Value Investments**: Implement ESLint boundary rules to programmatically enforce Deep Modules restrictions (preventing imports from `/internal/`).

---

### Type Safety, Architecture & Change Safety

#### Type Safety Assessment
**Score: 95/100**

##### Evidence
- **Language**: TypeScript & Kotlin.
- **Language tier**: Statically-typed.
- **Strict mode**: `"strict": true` enabled in all tsconfigs across backend, web, and packages.
- **`any` usage**: 266 occurrences across 464 source files (< 0.6 per file, < 2% of annotations).
- **Escape hatches**: Only 3 `@ts-ignore` / `@ts-expect-error` comments in the entire repository.
- **Runtime validation**: TypeBox schemas on Elysia route boundaries (`apps/backend/src/modules/*/schemas.ts`) and Zod schemas in `apps/web`.
- **Database invariants**: Drizzle ORM schema with 83 explicit constraints (`notNull`, `unique`, `references`, `check`) in `packages/db/src/schema/` (+5 modifier).
- **Contract-first API**: Canonical TypeScript contracts and OpenAPI schemas in `packages/contracts/src/` (+5 modifier).
- **CI enforcement**: Yes, `turbo run typecheck` runs on every PR.

##### Strengths
- Canonical contracts package (`@repo/contracts`) serves as the single source of truth across frontend, backend, and clients.
- Pervasive strict mode with minimal `any` escape hatches.
- Strong runtime boundary verification.

##### Gaps
- None significant; type safety is one of the strongest pillars of this repository.

##### Recommendations
- **Quick Wins**: Add branded types for IDs (e.g., `SeriesId`, `EpisodeId`) to prevent parameter transposition.

---

#### Architecture Clarity Assessment
**Score: 90/100**

##### Evidence
- **Directory structure**: Deep Modules monorepo with distinct separation between apps and packages.
- **Domain boundaries in filesystem**: Yes. Vertical feature slices located in `src/modules/<feature>/` with explicit public `index.ts`.
- **Domain grouping consistency**: High consistency across backend and frontend workspaces.
- **Service/domain layer**: Clear isolation of HTTP routing (`http.ts`), schemas (`schemas.ts`), and service repositories (`internal/`).
- **God objects in shared dirs**: None.
- **Scoped agent instructions**: 3 app-scoped `AGENTS.md` files (+5 modifier).
- **Cross-domain dependency explicitness**: Strict contract-first rule preventing cross-module internal imports.

##### Strengths
- Exceptional adherence to Deep Modules philosophy.
- Clean monorepo structure with clear boundaries between shared libraries and application runtimes.

##### Gaps
- Missing domain context map (`CONTEXT-MAP.md`).

##### Recommendations
- **Quick Wins**: Add `CONTEXT-MAP.md` illustrating module dependency graphs.

---

#### Change Safety Assessment
**Score: 68/100**

##### Evidence
- **Co-change coupling**: Low. Changes are neatly confined within individual apps and packages.
- **Highest-churn files**:
  - `apps/backend/src/modules/media/http.ts` (101 commits)
  - `apps/web/src/modules/videos/internal/api.ts` (75 commits)
  - `packages/media-service/src/index.ts` (61 commits)
- **Feature flags**: Absent (0 occurrences).
- **Migration safety**: Safe migration patterns enforced via policy: Drizzle migrations generate versioned SQL in `packages/db/drizzle/`, with direct `db:push` strictly forbidden in `AGENTS.md` (+3 modifier).
- **Module boundaries**: Enforced by convention and entry-point contracts.
- **Debt guard**: Level L0 (no automated baseline guard blocking structural debt in CI).

##### Strengths
- Strict policy guarding against destructive database migrations.
- Independent deployability of backend and frontend containers.

##### Gaps
- Lack of feature flag toggles for gradual rollouts.
- Absence of regression-aware quality gate to block newly introduced structural debt.

##### Recommendations
- **Quick Wins**: Integrate an environment-based or configuration-based feature flag helper.
- **High-Value Investments**: Adopt an L3 regression-aware debt guard for complexity and dead code.

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
*Generated by codebase-readiness skill — agent-skills*
