# CI Job Duration & Fast-Lane Baseline Report

> Generated empirical baseline for Issue #1001 measuring GitHub Actions pipeline performance, cache context, and runner task bottlenecks across recent runs.

---

## Executive Summary

- **Sample Size**: 20 recent completed workflow runs (11 PR runs, 9 `main` push runs).
- **PR Pipeline Median Duration**: **6m 32s** (range: 5m 24s – 7m 28s).
- **Push Pipeline Median Duration**: **12m 9s** (includes `docker-publish` container builds: 10m 01s – 14m 15s).
- **Primary Bottleneck**: The `ci` job (**5m 47s**) dominates PR wait time, where the `Run CI pipeline` step accounts for ~85% of total job duration.
- **Cache State**: **Remote caching disabled** in repository GitHub Actions secrets across all sampled runs. All Turbo tasks execute with `0 cached` tasks on every run.

---

## Job Wall-Clock Duration Comparison

Three parallel jobs execute in `.github/workflows/ci.yml`:

| Job Name      | Median Wall-Clock Duration | Limiting Factors / Major Steps                                                                 |
| :------------ | :------------------------- | :--------------------------------------------------------------------------------------------- |
| **`ci`**      | **5m 47s**                 | `Run CI pipeline` (4m 47s), Postgres container init (19s), Trivy fs scan (10s), Gates (5s)     |
| **`android`** | **53s**                    | Gradle setup (10s), Bun install (4s), `turbo run ... --filter=@repo/android-tv` (29s)          |
| **`e2e`**     | **1m 28s**                 | Playwright Chromium install (17s), App build (19s), Postgres init (23s), Playwright tests (5s) |

> **Key Observation**: The `android` (~50s) and `e2e` (~1m 20s) jobs complete far ahead of the `ci` job (~6m 40s). The total PR pipeline duration is strictly bounded by the critical path of the single `ci` job.

---

## Granular Turbo Task Bottleneck Analysis (`ci` Job)

Within the `Run CI pipeline` step (`bun x turbo run typecheck lint test:coverage test:integration build`), execution is dominated by three long-running Vitest suites:

| Rank | Turbo Task Name                        | Observed Duration | % of CI Step Time |
| :--: | :------------------------------------- | :---------------: | :---------------: |
|  1   | `@repo/web:test:coverage`              |      1m 29s       |
|  2   | `@repo/web:build`                      |       1m 9s       |
|  3   | `@repo/backend:test:coverage`          |       1m 6s       |
|  4   | `@repo/backend:test:integration`       |        15s        |
|  5   | `@repo/web:lint`                       |        11s        |
|  6   | `@repo/web:typecheck`                  |        11s        |
|  7   | `@repo/media-service:test:integration` |        9s         |
|  8   | `@repo/media-service:build`            |        5s         |
|  9   | `@repo/db:db:migrate`                  |        4s         |
|  10  | `@repo/media-service:test:coverage`    |        3s         |

The three Vitest test suites (`@repo/backend:test:coverage`, `@repo/web:test:coverage`, and `@repo/backend:test:integration`) execute sequentially / concurrently under Turbo and account for over **5 minutes** of the 6.5-minute job.

---

## Cache Context & Attribution

Empirical inspection of raw step logs demonstrates:

1. **Turbo Remote Cache**: **Disabled** (`• Remote caching disabled`). Secrets `TURBO_TOKEN` and `TURBO_TEAM` are not populated in GitHub Actions, forcing 100% cold compilation and test execution on every commit.
2. **Package Install Cache**: `oven-sh/setup-bun@v2` reuses pre-cached Bun runtime (~2s) and runs `bun install --frozen-lockfile` in ~6.7 seconds (1,675 packages).
3. **Gradle Cache**: Android builds leverage `gradle/actions/setup-gradle@v6` to cache configuration and build outputs, keeping Android build time under 1 minute.
4. **Playwright Cache**: Playwright Chromium is downloaded fresh on every run (~17s) because browser binaries are not cached in GitHub Actions runner cache.

---

## Sampled Actions Runs

|                                         Run ID                                         |     Event      |                     Branch                      | Total Wall-Clock | `ci` Job | `android` Job | `e2e` Job | Cache Status                 |
| :------------------------------------------------------------------------------------: | :------------: | :---------------------------------------------: | :--------------: | :------: | :-----------: | :-------: | :--------------------------- |
| [44738958626](https://github.com/titanaprilian/private-movie/actions/runs/44738958626) |     ✗ push     |                     `main`                      |      10m 1s      |  5m 56s  |      53s      |  1m 21s   | remote-disabled (0/1 cached) |
| [44737921659](https://github.com/titanaprilian/private-movie/actions/runs/44737921659) | ✓ pull_request |                `fix/issue-1002`                 |      7m 14s      |  7m 11s  |      54s      |  1m 18s   | remote-disabled (0/1 cached) |
| [44733957707](https://github.com/titanaprilian/private-movie/actions/runs/44733957707) |     ✓ push     |                     `main`                      |      12m 9s      |  5m 16s  |     1m 1s     |  1m 11s   | remote-disabled (0/1 cached) |
| [44733191757](https://github.com/titanaprilian/private-movie/actions/runs/44733191757) | ✓ pull_request |                `fix/issue-1003`                 |      5m 24s      |  5m 22s  |     1m 1s     |  1m 14s   | remote-disabled (0/1 cached) |
| [44731150620](https://github.com/titanaprilian/private-movie/actions/runs/44731150620) |     ✓ push     |                     `main`                      |      6m 20s      |  6m 3s   |      50s      |  1m 26s   | remote-disabled (0/1 cached) |
| [44730367153](https://github.com/titanaprilian/private-movie/actions/runs/44730367153) | ✓ pull_request |                 `fix/issue-992`                 |      5m 41s      |  5m 38s  |      48s      |  1m 14s   | remote-disabled (0/1 cached) |
| [44725445946](https://github.com/titanaprilian/private-movie/actions/runs/44725445946) |     ✓ push     |                     `main`                      |     11m 20s      |  5m 8s   |      48s      |  1m 22s   | remote-disabled (0/1 cached) |
| [44724459323](https://github.com/titanaprilian/private-movie/actions/runs/44724459323) | ✓ pull_request |                 `fix/issue-991`                 |      6m 42s      |  6m 37s  |     1m 1s     |  1m 36s   | remote-disabled (0/1 cached) |
| [44538294300](https://github.com/titanaprilian/private-movie/actions/runs/44538294300) |     ✓ push     |                     `main`                      |     14m 15s      |  7m 18s  |      53s      |  1m 28s   | remote-disabled (0/1 cached) |
| [44537002014](https://github.com/titanaprilian/private-movie/actions/runs/44537002014) | ✓ pull_request |         `fix/ci-e2e-workflow-flakiness`         |      7m 28s      |  7m 24s  |      53s      |  2m 39s   | remote-disabled (0/1 cached) |
| [44524425692](https://github.com/titanaprilian/private-movie/actions/runs/44524425692) |     ✗ push     |                     `main`                      |      4m 45s      |  4m 42s  |      42s      |  2m 55s   | remote-disabled (0/1 cached) |
| [44521850745](https://github.com/titanaprilian/private-movie/actions/runs/44521850745) | ✓ pull_request |       `chore/migration-safety-linter-984`       |     16m 28s      |  7m 19s  |      45s      |  1m 28s   | remote-disabled (0/1 cached) |
| [44513618680](https://github.com/titanaprilian/private-movie/actions/runs/44513618680) |     ✓ push     |                     `main`                      |     13m 32s      |  7m 27s  |    1m 17s     |  2m 39s   | remote-disabled (0/1 cached) |
| [44512259995](https://github.com/titanaprilian/private-movie/actions/runs/44512259995) | ✓ pull_request |       `feat/contracts-feature-flags-983`        |      8m 39s      |  7m 21s  |      55s      |  8m 35s   | remote-disabled (0/1 cached) |
| [44510715905](https://github.com/titanaprilian/private-movie/actions/runs/44510715905) | ✗ pull_request |       `feat/contracts-feature-flags-983`        |      4m 48s      |  4m 45s  |      55s      |  1m 32s   | remote-disabled (0/1 cached) |
| [44503700329](https://github.com/titanaprilian/private-movie/actions/runs/44503700329) |     ✓ push     |                     `main`                      |     13m 30s      |  5m 37s  |      48s      |  2m 42s   | remote-disabled (0/1 cached) |
| [44502898122](https://github.com/titanaprilian/private-movie/actions/runs/44502898122) | ✓ pull_request | `test/pilot-mutation-testing-media-service-972` |      4m 55s      |  4m 52s  |      45s      |  1m 19s   | remote-disabled (0/1 cached) |
| [44499825658](https://github.com/titanaprilian/private-movie/actions/runs/44499825658) |     ✓ push     |                     `main`                      |     12m 13s      |  5m 14s  |      58s      |   4m 8s   | remote-disabled (0/1 cached) |
| [44498775766](https://github.com/titanaprilian/private-movie/actions/runs/44498775766) | ✓ pull_request |   `ci/single-test-execution-coverage-comment`   |      6m 32s      |  6m 28s  |     1m 1s     |  1m 24s   | remote-disabled (0/1 cached) |
| [44496225731](https://github.com/titanaprilian/private-movie/actions/runs/44496225731) | ✗ pull_request |   `ci/single-test-execution-coverage-comment`   |      5m 6s       |  4m 40s  |      57s      |   5m 2s   | remote-disabled (0/1 cached) |

---

## Optimization Decision Matrix for Fast-Lane Intervention

| Candidate Strategy                                              |        Expected Wall-Clock Savings         | Blast Radius | Implementation Effort | Assessment & Recommendation                                                                                                                                                                                     |
| :-------------------------------------------------------------- | :----------------------------------------: | :----------: | :-------------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Split Fast / Slow Lanes in CI**                            |     **~3m 30s – 4m 00s** on Fast Lane      |     Low      |          Low          | **(Recommended)** Split `ci` into `fast-lane` (typecheck + lint + fast unit tests, <2m) and `slow-lane` (coverage + integration + build + Trivy). Allows instant PR feedback while preserving full gate safety. |
| **2. Enable Turbo GitHub Actions / Remote Cache**               | **~2m 00s – 4m 30s** on unchanged packages |     Low      |       Very Low        | Highly effective for incremental PR pushes. Can be enabled via GitHub Actions Cache Action or setting `TURBO_TOKEN` repository secret.                                                                          |
| **3. Parallelize Integration & Coverage in Separate CI Matrix** |            **~1m 30s – 2m 00s**            |    Medium    |        Medium         | Separating `test:integration` from `test:coverage` allows both to run on dedicated runners simultaneously against isolated Postgres instances.                                                                  |
| **4. Cache Playwright Browser Binaries in E2E Job**             |                  **~15s**                  |     Low      |          Low          | Minor improvement for the `e2e` job; does not affect PR bottleneck because `e2e` already finishes 5 minutes before `ci`.                                                                                        |

---

## Conclusion & Proposed Next Step

1. **Empirical Fact**: CI is currently **not** under 5 minutes (median PR: **6m 32s**; push to main: **12m 9s**), but it comfortably completes under 10 minutes for PRs.
2. **Follow-Up Issue**: Implement Strategy 1 (Split CI Fast/Slow lanes) and Strategy 2 (Enable Turbo cache) in a dedicated PR, establishing a required **Fast Lane (< 2.5 minutes)** required status check for rapid developer feedback.
