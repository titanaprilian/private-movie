# Testing commands

Read this before running any test.

## Mandatory rule

- **NEVER** run bare `bun test` or `bun --filter=<pkg> test`. In Bun, `test` is a built-in top-level command that ignores `--filter` and runs all monorepo tests natively without the required Vitest/Node environment.
- Avoid raw `bun --filter=@repo/web run test`: it bypasses Turbo's cache and forces an uncached 2-3 minute full re-run.

## Packages

`web`, `backend`, `seed-cli`, `media-service`, `media-scraper`, `db`, `contracts`

## During the TDD red → green loop: targeted runs (fast feedback)

Pass the specific test file path through the double `--` separator so it reaches Vitest:

```bash
bun run test:<pkg> -- -- test/unit/<feature>/<name>.test.ts
# equivalently, with Turbo directly:
bunx turbo run test --filter=@repo/<pkg> -- test/unit/<feature>/<name>.test.ts
```

Example: `bun run test:web -- -- test/unit/auth/LoginForm.test.tsx`

This runs in about 2-5 seconds instead of the full suite (1-3 minutes).

## Integration tests

If the ticket touches backend HTTP endpoints (routes, middleware, CORS, auth guards), also write and run integration tests under `test/integration/`, not just unit tests.

Run ONLY the integration test file(s) relevant to your change:

```bash
bun --filter=@repo/backend run test:integration test/integration/<feature>/<name>.test.ts
```

This executes against **your worktree's own test database** (TESTDB) in about 2-3 seconds instead of running the entire 54-file suite. Verify your targeted integration test passes before handing back. Never run integration tests against any shared database.

## Before handing back: full runs (so Turbo caches passing results for the reviewer)

```bash
bun run test:<pkg>                       # or: bunx turbo run test --filter=@repo/<pkg>
bun run test                             # all unit tests via Turbo
```
