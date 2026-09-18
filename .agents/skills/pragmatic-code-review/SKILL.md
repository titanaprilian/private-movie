---
name: pragmatic-code-review
description: "Review a codebase or app (e.g. apps/web) for code smells and design problems using core Pragmatic Programmer principles (DRY as knowledge duplication, orthogonality/coupling, broken windows, tracer bullets, reversibility, programming by coincidence, design by contract, YAGNI/good-enough software) plus this user's Deep Modules convention. Produces a findings report proposing a redesign, then hands off into the grill-me skill to interview the user one question at a time until there is shared understanding on the redesign before any code is written. Use whenever the user asks to review, audit, or find smells in an app/module, asks 'what should be redesigned', or wants a Pragmatic-Programmer-style critique before refactoring."
---

# Pragmatic Code Review → Grill Me

Two-phase workflow: **(1) diagnose** the codebase against Pragmatic Programmer
principles, then **(2) interview** the user (via the `grill-me` skill) about
every proposed redesign decision before writing any code. Never skip phase 2
— a smell report the user hasn't been grilled on is not a shared plan yet.

## Phase 1 — Diagnose

1. **Scope**: confirm (or infer from the request) which app/module/package to
   review — e.g. `apps/web`. If ambiguous, ask once before diving in.
2. **Explore the actual code**, don't guess from file names alone. Read entry
   points, then follow imports into the modules that do real work. For this
   user's monorepo, pay special attention to whether module boundaries follow
   the **Deep Modules (Graybox Module)** pattern — a deep module has a small,
   simple interface hiding real complexity; a shallow one leaks its internals
   through its API/props/exports.
3. **Classify every smell you find under one of these principles** (from _The
   Pragmatic Programmer_). Don't just list smells — name the principle they
   violate, since that's what frames the redesign conversation later:

   | Principle                           | What to look for                                                                                                                                                                                                     |
   | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | **DRY (knowledge duplication)**     | Same _knowledge_ expressed in two places (not just copy-pasted text) — duplicated validation rules, duplicated business logic across a route and a component, schema drift between Drizzle models and TanStack types |
   | **Orthogonality**                   | Changing one thing forces changes elsewhere; tight coupling; a UI change that requires touching the DB layer                                                                                                         |
   | **Deep Modules / shallow modules**  | Wide interfaces, leaky abstractions, a "God" module/hook/component doing too much or exposing too much                                                                                                               |
   | **Broken windows**                  | Dead code, stale TODOs, inconsistent patterns left to rot, one hacky exception that invited more hacks                                                                                                               |
   | **Programming by coincidence**      | Code that works but nobody can explain why; magic values; untested assumptions about ordering/timing                                                                                                                 |
   | **Tracer bullets / reversibility**  | Big-bang designs with no incremental path; decisions that are expensive to undo (e.g. baked-in schema choices, hard framework lock-in)                                                                               |
   | **YAGNI / good-enough software**    | Speculative abstraction, config for hypothetical futures, over-engineering vs. the actual current need                                                                                                               |
   | **Design by contract / assertions** | Missing input validation, no pre/post-condition checks, silent failure paths                                                                                                                                         |
   | **Orthogonal to this user's stack** | Elysia route handlers doing DB + validation + business logic inline instead of delegating to deep modules; Drizzle queries scattered instead of centralized; TanStack Router loaders bypassing the module boundary   |

4. **Write the findings report** (in the reply, or as a file if the user wants
   to keep it — see the file-creation rules) with, for each finding:
   - **What** — the smell, with a file/module reference
   - **Principle violated** — from the table above
   - **Why it matters** — concrete cost (bug risk, change friction, onboarding cost)
   - **Proposed redesign direction** — a sketch, not a full spec; leave the
     actual decisions open for phase 2

5. **Stop here.** Do not start writing redesign code yet, even if the user
   seems eager — the point of this skill is to reach shared understanding
   first.

## Phase 2 — Grill Me (shared understanding before redesign)

Once the findings report exists, immediately transition into the `grill-me`
skill's interview mode over the **proposed redesign directions** from step 4
— treat each finding's redesign direction as a branch of the decision tree.

Follow `grill-me`'s own instructions exactly:

- Interview the user relentlessly about every aspect of the redesign plan
  until reaching shared understanding, walking down each branch of the
  design tree and resolving dependencies between decisions one by one.
- For each question, give your own recommended answer.
- Ask questions **one at a time** — never a batch of open questions at once.
- If a question can be answered by exploring the codebase instead of asking
  the user, explore the codebase.

Order the branches sensibly: resolve foundational/architectural decisions
(e.g. "does this redesign change the module boundary or just the internals?")
before surface-level ones (e.g. naming, file layout). A later answer should
never re-open a branch already resolved unless the user raises it.

## Output of the whole workflow

The workflow is done only when every branch from the findings report has
been walked and resolved with the user. At that point, summarize the agreed
redesign as a short plan (principles fixed, decisions made, and why) before
any implementation begins — this summary is the shared understanding the
two phases exist to produce.
