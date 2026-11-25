# The factory is two Ralph loops on the laptop: implement and review

> Amended by ADR 0018: the loops act as a dedicated factory GitHub user, not the developer's own. ADRs 0017 and 0018 add the `main-red` fix ticket and the rebase flow.

The software factory is **two bash loops in the Ralph style**, running on the developer's laptop under their Claude subscription login: `./factory implement` and `./factory review`. Each one is a thin shell script over `gh` and `claude -p`. Each pass starts a fresh headless session, so context never builds up across tickets. When a loop has nothing to take, it sleeps (about 5 minutes) and polls again. Ctrl-C stops it between passes. There is no daemon.

Every run uses `--permission-mode auto --permission-prompts none` with `--max-budget-usd` and `--max-turns` caps, and returns a JSON status. Runs never use `--bare`, because the project skills and hooks must load. `ANTHROPIC_API_KEY` stays unset, so usage stays on the subscription.

**Intake.** The loop takes only issues the human has labelled `ready-for-agent` that have no open `blocked_by` and no assignee, first in backlog order. The script, not Claude, claims the ticket by assigning it and adding `in-progress`, before the session starts.

**One ticket in flight.** The implement loop starts a new ticket only when no factory PR is open. When it starts a pass, it first looks for its own open PR labelled `review:changes-requested`. If there is one, it resumes that ticket's session (`--resume`, same worktree) to address the comments. Otherwise it runs `claude -p "/implement-ticket N" --worktree issue-N`.

**Implement pass (`/implement-ticket`).** For each acceptance criterion, in TDD order:

1. A **tester** subagent writes the failing tests and commits them.
2. An **implementer** subagent makes them pass, then refactors. It may add new tests but never change or delete a tracked test. A PreToolUse hook in its frontmatter denies Edit and Write on tracked test files. When a ticket changes existing behaviour, the tester is the one who rewrites the old tests.

A Stop hook blocks finishing until `./check --quick` passes (ADR 0007). The pass then pushes and opens a PR with `Closes #N`. The full `./check`, with the mutation gate and e2e journeys, runs in CI.

**Review pass (`/review-pr`).** The review loop takes the oldest factory PR with green required checks and no verdict for its latest commit. A fresh session, sharing nothing with the implementer, runs `/code-review` and the five-item checklist from ADR 0008 against the ticket's acceptance criteria. It also fails the review if any test changed after the tester's commits. Both loops act as the developer's GitHub user, and an author can't approve their own PR. The verdict is therefore a review comment plus a label: `review:approved` or `review:changes-requested`. The merge decision is ADR 0016.

**Caps.** After 3 review rounds, or 2 CI failures, the PR is labelled `ready-for-human` and the loop moves on.

**Failure.** If a pass fails (budget or turn cap hit, `./check --quick` never green, a crash, or a ticket too unclear to implement), the loop:

- comments on the issue with the reason and the session id
- unassigns it and swaps `in-progress` for `needs-info` (unclear ticket) or `ready-for-human` (anything else)
- pushes the branch as a draft PR if it has commits, and keeps the worktree
- **stops**, so one systemic fault (a broken `main`, an expired login) can't fail the whole backlog in turn

**Guardrails.** Committed PreToolUse hooks deny pushes to `main`, force-pushes, `gh pr merge` anywhere except the review loop's merge step, and edits to `.github/` and to the factory's own scripts, skills and hooks. Branch protection on `main` backs these up: hooks fail open, so CI stays the hard gate.

## Considered Options

- **The Ralph Stop-hook plugin in one long session.** Rejected: context builds up across tickets, and losing finished work to compaction is the most expensive failure the research found.
- **The agent picks its own ticket in `PROMPT.md`.** Rejected: picking costs tokens, and a bad pick or a missed claim is harder to see than in a few lines of `gh`.
- **Cloud scheduled tasks, or `claude-code-action` in Actions, as the runner.** Rejected for v1: research preview with dropped events, or a PR-creation spike first; and `./dev`, Playwright and mutmut `--quick` already run natively on the laptop. Cloud intake stays a later upgrade.
- **Several implement loops in parallel.** Rejected for v1: the committed Orval client, `openapi.json` and `CONTEXT.md` would conflict, and claiming would need to be race-safe. One ticket in flight also means no per-worktree port logic is needed.
- **A single subagent-driven session with in-session reviewer subagents and a ledger.** Rejected: it duplicates the review loop. Tickets are sized for one session.
- **Retrying a failed pass, or carrying on to the next ticket.** Rejected: a systemic fault would burn through the backlog.
- **A `dontAsk` allowlist instead of auto mode.** Rejected: every new tool a ticket needs would stall a pass.

## Consequences

- The laptop must be on for the factory to run.
- The labels the factory consumes are `ready-for-agent`, `in-progress`, `needs-info`, `ready-for-human`, `review:approved`, `review:changes-requested` and `risk:human-merge` (ADR 0016).
- The backlog's ticket template must carry acceptance criteria precise enough for a tester subagent to turn into failing tests.
- The hooks and skills are committed project config, so a `-p` run executes them without a trust dialog. The factory's own files are therefore a risk class (ADR 0016).
