# Report template (Phase 2)

The report is delivered as a GitHub comment on the ticket, not as a file, so write nothing to disk or into the repo. Compose it in this structure and also give it as your reply. It is posted later: as a plain comment on Request changes, or as the closing comment after landing on Approve. Structure:

```
# Review: <ticket title / #number>

**Verdict:** Approve | Approve with follow-ups | Request changes
**Reviewed:** <branch or commit range>, <N files changed>
**Assumptions / open questions:** <anything you couldn't resolve, or "none">

## Acceptance criteria
- [x] <criterion> — met (<where / how verified>)
- [ ] <criterion> — not met / partial (<why>)

## Blocking findings
### 1. <short title>
- **Where:** <file:line or symbol>
- **Principle violated:** <from the principles table>
- **Why it matters:** <concrete cost>
- **Suggested fix:** <specific enough for the implementer to act on>

## Non-blocking findings
<same format; worth fixing but not worth holding the merge>

## Follow-ups (pre-existing or out of scope)
<smells in untouched code, candidates for separate tickets, one line each>

## What's good
<one to three specific things done well>
```

Rules:

- Omit empty sections, except the verdict, acceptance criteria, and assumptions line.
- The verdict follows the verdict rules in the main workflow: any unmet criterion, failing check, or blocking finding means **Request changes**.
- Every finding names a specific file and line or symbol you actually read, and one principle.
- Blocking findings go under "Blocking", nitpicks you can't attach a concrete cost to get dropped, and smells in untouched code go under "Follow-ups".

When the report is written, return to the workflow: next is Phase 3 (verdict and branching).
