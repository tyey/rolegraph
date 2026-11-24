# The review loop merges low-risk PRs; risk classes go to the human

The factory's review loop (ADR 0015) may merge a PR, but only through GitHub auto-merge and only outside the risk classes. Earlier research concluded that nothing Claude-side merges. This ADR replaces that with a narrower rule: an agent may *ask* GitHub to merge, and GitHub still merges only once every required check has passed.

**The rule.** After a `review:approved` verdict, the review script, not the reviewer session, checks the PR:

- If no changed file matches the committed risk globs and the ticket has no `risk:human-merge` label, it runs `gh pr merge --auto`. GitHub merges once the required checks pass.
- Otherwise it labels the PR `ready-for-human`, and the human merges.

**Risk classes** are a committed list of path globs that the script matches against the PR's changed files. They cover:

- database migrations
- Backup/Restore and export formats
- `.github/**`
- the factory's own scripts, skills and hooks, and `.claude/**`
- `docs/adr/**` and `CONTEXT.md`
- dependency manifests and lock files (`uv.lock`, `package-lock.json`, and the like)

The human can also set `risk:human-merge` at intake. A match always wins over the reviewer's verdict, so the agent never decides about its own gate.

**Branch protection** on `main` (detailed in the Factory CI & merge pipeline ticket) requires the `./check` CI jobs. It requires no approving review, because both loops act as the developer's own GitHub user and an author can't approve their own PR. Auto-merge must be allowed.

**Where the human approves:**

- at intake, by labelling an issue `ready-for-agent`
- every risk-class merge, and every PR that hits a cap (ADR 0015)
- every failed pass, handed back as `needs-info` or `ready-for-human`

Releases stay manual (ADR 0009), so no factory merge reaches real data until the human cuts a tag.

## Considered Options

- **Human merges everything.** Rejected: the human would be the bottleneck on every low-risk ticket, when the CI gates (ADRs 0007, 0008) already block what a reviewer would catch mechanically.
- **Merge everything that is green and approved.** Rejected: migrations, data formats and the factory's own gates are hard to undo or can weaken the checks themselves.
- **The reviewer judges risk from the diff.** Rejected: it is the agent deciding about its own gate. Globs are deterministic.
- **A GitHub App or machine user that posts real approving reviews**, with one approval required. Rejected for v1: an extra App and a token on the laptop, for a check the label and auto-merge already provide.

## Consequences

- The risk-glob list must grow as modules land: Backup/Restore and export code paths are added when they exist.
- A green CI is the only thing between an approved low-risk PR and `main`, so CI and branch protection must exist before the factory runs for real (ADR 0007).
