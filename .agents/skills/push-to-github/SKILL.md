---
name: push-to-github
description: "Push the combined spec branch to GitHub and open a pull request. Runs final monorepo checks before pushing. Run by the orchestrator agent after all tickets have been locally merged into the spec branch."
disable-model-invocation: true
---

# Push to GitHub

Get the combined spec branch up onto GitHub as a Pull Request. This runs after `pragmatic-code-review` has locally merged all approved tickets into the shared spec branch (e.g. `spec/<slug>`). This skill's job is verifying the combined work, getting it onto the remote, and opening the PR.

## 1. Sanity check & Checkout

- `git status` — if there are uncommitted changes, stop and flag it.
- Confirm you are on the delivery branch (e.g. `spec/<slug>`). If not, check it out.
- `gh repo view --json nameWithOwner,defaultBranchRef` — confirm the repo and its default branch (`main`).

## 2. Final Verification (Mandatory)

Because multiple tickets may have been merged into this branch in parallel, you must run the full monorepo checks to ensure the combined code doesn't conflict or break:

- `bun run typecheck`
- `bun run lint`
- `bun run test` (runs all unit tests via Turbo)

If any of these checks fail, **stop immediately**. Report the failure to the user. Do not push broken code to the remote.

## 3. Push and Open PR

Once checks pass, push the branch and open the PR. You do **not** need to ask the user whether to push directly to main — this project always uses Pull Requests.

- `git push -u origin <current-branch-name>`
- Open the PR with the `gh` CLI — consult **gh-cli** for the mechanics (safe `--body-file` heredocs, capturing the returned URL):

```bash
gh pr create \
  --title "<short, specific title>" \
  --body-file /tmp/pr-body.md \
  --base <default-branch> \
  --head <branch-name>
```

- **CRITICAL**: The PR body MUST explicitly include `Closes #<parent-spec-number>` so that merging the PR automatically closes the parent spec issue. Summarize what changed across all the tickets batched in this PR.
- **Parent Spec/PRD Update**: 
  - ALWAYS leave a short comment on the parent spec/PRD issue (`gh issue comment`) containing a link to this newly created PR, indicating that the batched work is now in review and will close the spec upon merge.
- Report the PR URL back to the user. Don't merge it yourself — opening the PR is the end of this skill's job; merging is a separate human decision.

## Never

- Never force-push (`--force` / `--force-with-lease`) without the user explicitly asking for it in that moment.
- Never push directly to main. All work goes through a Pull Request.
- Never merge a PR as part of this skill.
