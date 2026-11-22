---
name: to-tickets
description: Break a plan, spec, grilling session, or bug investigation into structured, dependency-linked GitHub issues matching the #1003 gold standard. Use whenever asked to create tickets, convert a spec/discussion into issues, or after a /grilling session.
---

# To Tickets

Break a plan, spec, architecture design, or `/grilling` session into a set of **structured, dependency-linked GitHub issues** conforming to the repository's gold standard ([Issue #1003](https://github.com/titanaprilian/private-movie/issues/1003)).

## Core Principles

1. **Context-Window Sizing (Matt Pocock)**: Every ticket must be sized to comfortably fit inside a single fresh agent context window without exhaustion. If a change requires multiple mental phases or touches several apps, break it down.
2. **One App per Ticket (`AGENTS.md`)**: Strictly observe repository boundary rules. At most one of `apps/web`, `apps/backend`, or `apps/android-tv` per ticket. Changes touching contracts (`packages/contracts`) and backend must be sequenced as the producer ticket before the web/android-tv consumer ticket.
3. **Explicit Blocking Edges**: Map the dependency graph. Publish blocker issues first so downstream issues can reference real `#<id>` numbers in their `Blocked by` section.
4. **Verifiable & Falsifiable (`principle-prove-it-works`)**: Every ticket must have a concrete `## Verification` section with exact commands (e.g. `bun run test:web -- -- <file>` or Playwright runbook). No ticket is accepted with vague "verify it works" prose.
5. **No Double Grilling**: Tickets written with this format are self-contained. When ingested by `herdr-orchestrator` and `poteto-mode`, the worker takes the ticket as a whole and skips exploratory interview rounds.

---

## Workflow

### 1. Gather Context & Slices

From the active conversation, spec, or `/grilling` frontier, draft discrete work units:

- Identify target app/package boundaries (`apps/backend`, `apps/web`, `packages/contracts`, etc.).
- Ensure producer changes (contracts, schemas) are ordered before consumer changes (UI, callers).
- Anchor descriptions to domain concepts and module interfaces (`DOMAIN.md`, `ARCHITECTURE.md`), avoiding fragile line numbers.

### 2. Quiz the User (Approval Gate)

Before writing anything to GitHub, present the proposed ticket breakdown in chat as a numbered list:

```markdown
### Proposed Tickets:

1. **[Backend] <Title>**
   - **App/Package:** `apps/backend` (and `packages/contracts`)
   - **Blocked by:** None (can start immediately)
   - **Delivers:** <What end-to-end behavior this enables>
   - **Verification:** `bun run test:backend -- -- <test-file>`

2. **[Web] <Title>**
   - **App/Package:** `apps/web`
   - **Blocked by:** Ticket 1
   - **Delivers:** <UI view or interaction>
   - **Verification:** `bun run test:web -- -- <test-file>`
```

Ask the user:

- Does the granularity feel right?
- Are the dependencies and app boundaries accurate?
- Should any ticket be split or combined?

### 3. Publish to GitHub Issues via `gh-cli`

Once approved, publish the tickets in topological dependency order (blockers first).

#### Preflight Check

```bash
gh auth status
gh repo view --json nameWithOwner
```

#### Issue Body Template (#1003 Gold Standard)

For each ticket, write the body to a temporary file (`/tmp/ticket-<n>.md`) using a quoted heredoc:

```markdown
## Goal

<Clear, high-level summary of the deliverable or behavior change>

## Type

<Bug fix | Feature | Chores / Tech Debt 🧹 | Refactor | Documentation | Operational safety gap>

## Steps to reproduce or inspect

1. <Step to observe current state or gap>
2. <Command or source file to inspect>

## Expected behavior

<What should happen when completed>

## Actual behavior

<What happens currently or what is missing>

## Logs and error messages

<Observed runtime errors, or "No runtime failure observed. Code inspection / architectural finding.">

## Visual evidence

<Screenshot link or "No screenshot collected. Backend/logic change.">

## Implementation scope

• <Target package or app, e.g. apps/backend or apps/web>
• <Concrete changes to make>
• <Boundary notes: e.g. public contracts must remain backward-compatible>

## Acceptance criteria

[ ] <Clear, binary criterion 1>
[ ] <Clear, binary criterion 2>
[ ] <Quality gate / test passing criterion>

## Verification

<Exact test command, e.g. `bun run test:backend -- -- test/unit/auth/login.test.ts` or Playwright step>

## Related issues and context

• Blocked by: #<id of blocker issue, or "None - can start immediately">
• Context: <Relevant PRs, docs, or architectural decisions>

## Agent instructions

Read the root and relevant scoped AGENTS.md before editing. Preserve public contracts and use focused checks. Follow the one-app-per-commit rule. Do not run db:migrate or db:push.
```

#### Creating the Issue

```bash
gh issue create \
  --title "<Concise Title>" \
  --label "ticket" \
  --label "<Priority: low|medium|high>" \
  --label "<Type Label>" \
  --body-file /tmp/ticket-<n>.md
```

Capture the created issue URL and `#<id>` to link into subsequent tickets that depend on it.

### 4. Report Back

Output a summary of all published tickets with clickable GitHub issue links and their dependency chain so the user or `herdr-orchestrator` can begin execution.
