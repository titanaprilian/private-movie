---
name: to-spec
description: Turn the current conversation into a spec and publish it to the project issue tracker — no interview, just synthesis of what you've already discussed. The spec also names its delivery branch and the shared hotspots it changes, so its tickets can be built in parallel worktrees and merged into one spec branch.
disable-model-invocation: true
---

This skill takes the current conversation context and codebase understanding and produces a spec (you may know this document as a PRD). Do NOT interview the user — just synthesize what you already know.

The spec is the parent of everything that follows: `to-tickets` splits it into tickets, cheaper agents implement those tickets in parallel worktrees, each approved ticket is merged into a single **spec branch**, and one pull request from that branch to the main branch finally closes the spec. Write the spec so that chain works.

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary vocabulary throughout the spec, and respect any ADRs in the area you're touching. While you do, note the **hotspots** the work will change — shared areas that merge badly when two branches edit them: the DB schema and migrations directory, shared type or contract packages, generated files such as the router's route tree, lockfiles, and root config.

2. Sketch out the seams at which you're going to test the feature. Existing seams should be preferred to new ones. Use the highest seam possible. If new seams are needed, propose them at the highest point you can. The fewer seams across the codebase, the better - the ideal number is one.

Check with the user that these seams match their expectations. In the same check, tell the user if the spec looks too big: the spec branch lives from the first ticket until the final pull request, so a spec that would take more than a few days of ticket work, or whose final PR would be too large to review in one sitting, should be split into separate specs that can each ship on their own. Propose the split; don't silently shrink or split the spec.

3. Check for overlap with other work in flight:

```bash
gh issue list --label spec --state open --json number,title,body --limit 50
```

Compare each open spec's **Hotspots** section with yours (older specs may not have one; skip those). If another open spec shares a hotspot, name it under Further Notes and tell the user in your reply, so they can sequence the two specs instead of running them side by side. Conflicts between specs would otherwise only surface when the second spec's final PR is merged.

4. Write the spec using the template below, then publish it to the project's GitHub Issues using the /gh-cli skill.
   - **CRITICAL**: You MUST explicitly add the `spec` label to the issue when creating it via the `gh` CLI (e.g., `gh issue create ... --label "spec"`). If the label does not exist, create it first using `gh label create spec`.

5. Record the delivery branch. Once the issue exists you know its number. Name the branch `spec/<issue-number>-<slug>`, where the slug is the spec title in lowercase ASCII, words joined by hyphens, at most five words (e.g. `spec/42-admin-sidebar-redesign`). Replace the `Branch:` placeholder line in the spec body with that name and update the issue (`gh issue edit <issue-number> --body-file <file>`; consult /gh-cli for the safe mechanics). Do **not** create the branch here: `to-tickets` creates it from the latest main when it publishes the tickets, and every other skill derives the same name from the issue number and title.

<spec-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

This list of user stories should be extremely extensive and cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Write each decision as a short, standalone statement that an implementing agent could follow without having seen this conversation. `to-tickets` copies these into individual tickets for cheaper agents, which cannot ask what you meant. Where an existing module already does something similar, name it as the pattern to imitate (module or directory level).

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Hotspots

The shared areas this spec will change that tend to conflict when two branches edit them: the DB schema and migrations directory, shared type or contract packages, generated files, lockfiles, root config. Name directories, not individual files. Write "None" if there are none. `to-tickets` uses this list to decide which tickets must not run in parallel.

## Delivery

Branch: _assigned after the spec is published_

Every ticket for this spec is implemented and reviewed in its own worktree, then merged into this branch. When all tickets are in, one pull request from this branch to the main branch closes this spec.

## Out of Scope

A description of the things that are out of scope for this spec.

## Further Notes

Any further notes about the feature.

**Open questions:** decisions that are not settled yet. List them here, one per line, so `to-tickets` raises them with the user instead of guessing. Leave this out if there are none.

</spec-template>
