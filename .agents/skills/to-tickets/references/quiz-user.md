# Quiz the user

Phase 2 of `/to-tickets`: step 4. Present the breakdown and iterate until the user approves it.

### 4. Quiz the user

First, settle the **mode** and the **delivery branch**.

**Mode.** Confirm the mode you proposed in step 2b, say why in a sentence, and let the user choose. The user's choice always wins. If they pick the other mode, follow the last paragraph of step 2b in `explore-and-slice.md`.

**Delivery branch.** The branch every ticket uses as its Base:

- If the work comes from a spec issue, use the `Branch:` recorded in the spec's Delivery section. If an older spec has none, derive it as `spec/<issue-number>-<slug>` (slug: the spec title in lowercase ASCII, words joined by hyphens, at most five words) and say that you derived it.
- If there is no parent spec, propose a short slug and ask the user to confirm or change it; the branch is `spec/<slug>`.

Then present the proposed breakdown as a numbered list. In separate mode group it by wave; in shared mode list it in the order the tickets will be done. For each ticket, show:

- **Title**: short descriptive name
- **Blocked by**: which other tickets (if any) must complete first, each marked _needs output_ or _ordering only_
- **What it delivers**: the end-to-end behavior this ticket makes work
- **Decisions already made**: the design choices fixed up front, in one line each
- **Touches**: the hotspots this ticket changes
- **Location**: the anchor docs and directories this ticket points to

If the spec listed **Open questions**, put each one to the user now, one at a time, with your recommended answer. Don't publish tickets that rest on an unsettled decision.

Ask the user:

- Is the mode right (separate worktrees, or one shared worktree)?
- Is the delivery branch name right?
- Does the granularity feel right for a cheaper agent? (too coarse / too fine)
- Are the blocking edges correct — does each ticket only depend on tickets that genuinely gate it? (Shared mode: is the order right?)
- Separate mode only: are the ordering-only edges worth their cost in parallelism, or should the shared hotspot be split into its own prefactor ticket instead? Within each wave, do any two tickets still share a Touches entry without an edge between them?
- Could a cheaper agent finish each ticket without making a design decision? Is any decision still open that you want to settle now?
- Should any tickets be merged or split further?
- Is the Location list for each ticket accurate and sufficient — anything missing that a fresh agent would still have to go hunt for?

Iterate until the user approves the breakdown.
