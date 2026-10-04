---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

## Step 0 — Triage (before grilling)

Before starting the interview, estimate how many tickets this work would realistically break into. Base the estimate on concrete signals: distinct concerns or modules touched, whether contracts/schema changes are needed, and how many independently-testable units of work exist. Count tickets the way `/to-tickets` will cut them: each ticket is one focused behavior small enough for a cheaper agent's context, so when in doubt, count more, not fewer. If any of this can be checked by exploring the repo (existing module boundaries, whether the change implies a `packages/contracts` update, etc.) rather than guessed, look it up first.

Apply this rule:

- Touches `packages/contracts` or requires a DB schema change? → **spec required**, regardless of estimated size. Skip the rest of this triage and go straight to the full interview below.
- Estimated ticket count ≤ 2 → recommend the **direct-to-ticket** path (skip `/to-spec`, go straight to `/to-tickets` after a short round of clarifying questions).
- Estimated ticket count ≥ 3 → recommend the **full spec** path (proceed with the full interview below, then `/to-spec`).

State your estimate and reasoning in one or two sentences, then ask the user to confirm or override. For example:

> "This looks like it'll break into about 1–2 tickets, confined to one module with no contract changes — I'd recommend skipping the spec and going straight to /to-tickets. Want that, or a full grill + spec anyway?"

Never proceed past this point without the user's explicit confirmation of which path to take. The triage is a recommendation; the decision is the user's.

**If the user confirms direct-to-ticket:**
Still ask any _necessary_ clarifying questions one at a time — skip the full branch-by-branch interrogation below, not the fact-finding. "Necessary" includes anything a cheaper implementing agent would otherwise have to decide on its own: the existing module to imitate, naming, where the new code lives, how errors surface, and which test level proves it. There is no spec issue on this path, so `/to-tickets` will ask the user for a short branch slug for the delivery branch. Once the essential facts are confirmed, write the **Decision summary** (below) and stop; tell the user you're ready to hand off to `/to-tickets`; do not invoke it yourself without being asked.

**Escalation guard:** if `/to-tickets` ends up producing 3 or more tickets after a direct-to-ticket path was chosen, stop before any implementation begins and flag it to the user:

> "This grew to N tickets once broken down — want to back up and write a spec before we proceed, or continue as-is?"

**If the user confirms the full spec path (or it was required by the override above), proceed with the full interview:**

---

## Full Interview

Interview me relentlessly about every aspect of this until we reach a shared understanding. Walk down each branch of the decision tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time, waiting for feedback on each question before continuing. Asking multiple questions at once is bewildering.

If a _fact_ can be found by exploring the environment (filesystem, tools, etc.), look it up rather than asking me. The _decisions_, though, are mine — put each one to me and wait for my answer.

Before wrapping up, make sure the decision tree has covered these branches (skip any that don't apply, and look up the facts rather than asking me for them):

- The existing module or pattern each new piece of work should imitate.
- The **hotspots** the work changes — shared areas that merge badly when two branches edit them: the DB schema and migrations directory, shared contracts, generated files such as the router's route tree, lockfiles, and root config.
- The testing seams and which test level proves each behavior.
- What is explicitly out of scope.
- Whether the work is small enough for one spec. A spec's branch lives until its final pull request, so work that would take more than a few days, or end in a PR too big to review in one sitting, should be split into separate specs.

Do not act on it until I confirm we have reached a shared understanding.

## Decision summary (both paths)

When we have reached shared understanding (or, on the direct-to-ticket path, the essential facts are confirmed), write a summary and ask me to confirm it. The spec and the tickets are written from this summary, and the agents that implement them cannot ask me what I meant, so it has to stand on its own:

- **Decisions:** a numbered list, one short statement each, understandable without this conversation. These become the spec's Implementation Decisions, or the tickets' "Decisions already made".
- **Pattern to imitate:** the existing module(s), at module or directory level.
- **Hotspots:** the shared areas the work changes, or "None".
- **Out of scope:** what we agreed not to do.
- **Open questions:** anything we did not settle. List it plainly; never paper over it.

Do not implement any code yet after the grilling session is completed, we will create a new spec using /to-spec skills after the grilling is completed. Prompt the user first before execute the /to-spec skills.
