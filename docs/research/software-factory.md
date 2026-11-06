# Research: Claude Code software-factory options

Ticket: [#8](https://github.com/tyey/rolegraph/issues/8) (part of the [wayfinder map](https://github.com/tyey/rolegraph/issues/1)). Researched 2026-11-06 against the live docs. Feeds the factory-execution-model decision ([#17](https://github.com/tyey/rolegraph/issues/17)). This note gathers facts; it does not make the design decision.

## Question

What options exist in late 2026 for a "software factory" that takes one GitHub backlog issue and produces a reviewed, tested PR with Claude Code? Cover:

- headless `claude -p` and the Claude Agent SDK
- subagent-driven development and skills
- git worktrees for parallel tickets
- `claude-code-action` in GitHub Actions
- scheduled and cloud routines

Compare them on ticket picking and claiming, TDD and coverage gating, review gates, merge policy, cost, and where the human stays in the loop.

## Short answer

These five options are not alternatives. They are layers, and a working factory stacks them:

- **Runner**: where a ticket session runs. One of: local `claude -p`, the Agent SDK, a GitHub Actions job, or a cloud session.
- **Isolation**: worktrees, so parallel tickets don't collide.
- **Inner loop**: subagents, skills and hooks. This layer covers TDD, self-review and the "don't stop until tests pass" rule.
- **Hard gates**: GitHub CI plus branch protection. These are the only gates the agent can't talk its way past.

No Claude surface merges PRs by itself:

- `claude-code-action` can't approve or merge.
- Code Review never approves or blocks.
- Merging is left to GitHub: a human, or `gh pr merge --auto` once required checks pass.

Claiming a ticket is also not built in for GitHub issues. You build it from labels and assignees plus a single dispatcher or a concurrency group. The one built-in claiming mechanism is the file-locked task list in the experimental agent teams, and it is local to one session.

---

## Key facts by building block

### 1. Headless `claude -p` and the Agent SDK

Source: [Run Claude Code programmatically](https://code.claude.com/docs/en/headless).

- **Basics**: `claude -p "<prompt>"` runs without interaction. It exits 0 on success and non-zero on failure.
  - `--output-format json` returns `result`, `session_id` and `total_cost_usd`. The cost figure is a client-side estimate.
  - `--json-schema` adds a validated `structured_output` field, so a dispatcher can read a machine-readable result, for example `{pr_url, status}`.
- **Permissions**:
  - With nothing set, `-p` runs start in Manual mode from v2.1.302. A call that needs approval is then denied.
  - `--permission-mode auto` has a classifier review each action.
  - `dontAsk` denies anything not pre-allowed.
  - `acceptEdits` auto-approves file edits.
  - `--permission-prompts none` is meant for unattended runs. Claude is told nobody can approve, and the run continues.
  - `--allowedTools` uses rule syntax such as `Bash(git commit *)`.
- **Caps**:
  - `--max-budget-usd` stops the run, background work included, when the budget is hit.
  - `--max-turns` is also available ([GitHub Actions doc](https://code.claude.com/docs/en/github-actions#pass-cli-arguments)).
- **`--bare`**:
  - Skips hooks, skills, subagents, plugins, MCP and CLAUDE.md discovery. It is "recommended for scripted and SDK calls, and will become the default for `-p` in a future release."
  - Hooks never run in bare mode.
  - Bare mode never reads OAuth or keychain credentials, so it needs `ANTHROPIC_API_KEY`.
  - A factory that relies on project skills and Stop-hook gates must therefore **not** use `--bare`, or must pass everything explicitly.
- **Safety caveat**: without `--bare`, a `-p` session runs the project's `.claude/settings.json` hooks and `.mcp.json` servers with no trust dialog.
- **Resuming**: `--resume <session_id>` continues a session. A dispatcher can use it to ask follow-ups, for example "address review comments", in the same context.

Agent SDK. Source: [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview).

- **What it adds**: the same loop as a Python or TypeScript library, plus hooks, subagents, permissions with a `canUseTool` callback, sessions, MCP and plugins.
- **When it's worth it**: when the orchestrator needs programmatic control, such as custom approval callbacks, streaming, or many concurrent sessions. A shell dispatcher around `claude -p --output-format json` covers the same loop for a single developer.
- **Auth rule**: "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods…"
  - The clause targets products offered to others.
  - The SDK quickstart assumes an API key.
  - Treat the SDK as API-billed unless policy says otherwise.

Auth and billing for headless runs. Source: [Authentication](https://code.claude.com/docs/en/authentication).

- **Precedence**: `ANTHROPIC_API_KEY` beats `CLAUDE_CODE_OAUTH_TOKEN`, which beats the `/login` subscription. In `-p`, an API key that is present "is always used".
- **Long-lived token**: `claude setup-token` mints a one-year subscription OAuth token (`CLAUDE_CODE_OAUTH_TOKEN`) "for CI pipelines and scripts" on Pro, Max, Ultra, Team and Enterprise plans.
  - It can only make model requests.
  - Bare mode doesn't read it.
- **Billing paths**: local `claude -p` under your own login uses subscription usage. An API key bills per token.

### 2. Subagents, skills and hooks (the inner loop)

Subagents. Source: [Subagents](https://code.claude.com/docs/en/sub-agents).

- **Definition**: Markdown with YAML frontmatter in `.claude/agents/`, committed with the repo.
- **Fields**: `tools` / `disallowedTools`, `model`, `permissionMode`, `skills` (full content injected), `hooks`, `memory`, `background`, and `isolation: worktree`.
- **Context**: each subagent has its own context window. Only its summary returns. Nesting goes up to 3 levels by default.
- **Fit**: this is what makes "fresh implementer per task, separate reviewer" possible inside a single ticket session.

Bundled skills relevant to a factory. Source: [Commands](https://code.claude.com/docs/en/commands).

- **`/batch <instruction>`**: splits work into 5 to 30 independent units and presents a plan. After approval, it spawns one background subagent per unit in its own worktree, and "each subagent implements its unit, runs tests, and opens a PR". It is a fan-out of one large change, not a backlog consumer.
- **`/code-review [level] [--fix] [--comment] [pr#]`**: correctness review of a diff or PR. It can post inline comments on GitHub. Works on any plan.
- **`/simplify`**: four parallel cleanup reviewers. It doesn't look for bugs.
- **`/goal <condition>`**: Claude keeps working across turns until the condition is met.
- **`/autofix-pr`**: spawns a cloud session that watches the PR and pushes fixes for CI failures and review comments.

Hooks as gates. Source: [Hooks](https://code.claude.com/docs/en/hooks).

- **Stop**: exit code 2, or `decision: "block"`, "prevents Claude from stopping". The documented example runs the test suite and blocks on failure. This is how to make "tests and coverage pass" a precondition for finishing.
- **Other blocking events**: `SubagentStop`, `TaskCompleted` and `TeammateIdle` block the same way.
- **PreToolUse**: can deny tool calls, for example pushes to `main` or edits to `.github/workflows`.
- **Caveat**: on Stop-type events, "Claude can't repair a hook that won't run". A broken gate script fails open, so keep CI as the real gate.
- **Judgment gates**: `prompt` hooks (single-turn model check) and `agent` hooks (experimental) can make calls such as "is the issue's acceptance criteria met?".

Community pattern: subagent-driven development. Source: [superpowers](https://github.com/obra/superpowers) plugin v6.4.2, skill `subagent-driven-development`. Read from the installed copy.

- **Per task**: dispatch a fresh implementer subagent, which implements, tests, commits and self-reviews.
- **Review**: a separate reviewer subagent checks spec compliance and code quality.
- **Fix loop**: up to 5 fix rounds. From round 4, a fresh implementer on a more capable model takes over. Then comes a final whole-branch review.
- **Ledger**: progress lives in a git-ignored ledger file, so a session that loses context to compaction doesn't redo finished tasks. The skill calls this redo "the single most expensive failure observed".
- **When it stops**: it doesn't stop to ask between tasks. It records "rulings" in the ledger instead. It stops only for:
  - irreversible or destructive operations
  - security-sensitive actions
  - side effects outside the worktree, such as merging or pushing to a shared branch
  - a hopelessly broken plan
- **Companion skills**: `test-driven-development`, `using-git-worktrees` and `finishing-a-development-branch`.
- **Mapping to the factory**: the pattern maps directly onto "one issue becomes one PR", with the issue as the plan. The map also names the `tdd` skill for factory tickets.

### 3. Git worktrees (parallel tickets)

Source: [Worktrees](https://code.claude.com/docs/en/worktrees).

- **Creating one**: `claude --worktree <name>` (or `-w`) creates `.claude/worktrees/<name>/` on branch `worktree-<name>`.
  - By default it branches from the remote default branch (`worktree.baseRef: "fresh"`). `"head"` branches from local HEAD instead.
  - `--worktree "#123"` branches from a PR.
  - `claude -p --worktree` skips the trust check.
- **Isolation**: Claude Code blocks edits, command working directories and git redirects that target the main checkout. Shell writes such as `cp` aren't tracked.
- **Gitignored files**: `.worktreeinclude` copies files such as `.env` into each worktree. Otherwise you get a fresh checkout and dependencies must be installed again.
- **Cleanup**:
  - `-p` runs don't clean up their worktrees. Remove them with `git worktree remove`.
  - Subagent worktrees with no changes are removed automatically.
  - Others are swept after `cleanupPeriodDays`, but only when they hold no unpushed work.
- **Inference, not from the docs**: worktrees isolate files only, not ports, databases or caches.
  - Rolegraph's embedded storage and dev-server ports need a per-worktree setting, for example the data dir and port taken from the worktree name. Otherwise parallel test runs will collide.

Agent teams. Source: [Agent teams](https://code.claude.com/docs/en/agent-teams).

- **Status**: experimental and off by default (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`).
- **Task list**: there is a shared task list with dependencies, and blocked tasks aren't self-claimed. "Task claiming uses file locking to prevent race conditions."
- **Hooks**: `TeammateIdle`, `TaskCreated` and `TaskCompleted` can enforce quality gates.
- **Limits**:
  - Not available in `-p` or the SDK: "Claude doesn't spawn teammates" there.
  - One team per session.
  - In-process teammates aren't restored when you resume.
  - Task status can lag.
- **Cost**: about 7x the tokens when teammates run in plan mode ([Costs](https://code.claude.com/docs/en/costs#manage-agent-team-costs)).
- **Fit**: an interactive tool for one parallel session, not an unattended backlog runner.

### 4. `claude-code-action` in GitHub Actions

Sources:

- [GitHub Actions doc](https://code.claude.com/docs/en/github-actions)
- [Capabilities and limitations](https://github.com/anthropics/claude-code-action/blob/main/docs/capabilities-and-limitations.md)
- [Inputs](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md)

**Modes**

- **Interactive mode**: no `prompt` input. Responds to `@claude` in comments, reviews, and new issue titles or bodies.
- **Automation mode**: a `prompt` input is set. Runs on any event, including `schedule`, `issues: [labeled]` and `pull_request`. The prompt can be a repo skill (`/skill-name`, after checkout) or a plugin skill.

**Triggers and inputs**

- `label_trigger` (for example `claude`), `assignee_trigger`, `trigger_phrase`, `base_branch`, `branch_prefix` (default `claude/`), and `claude_args`.
- `claude_args` passes any CLI flags, such as `--max-turns`, `--model` or `--allowedTools`.

**What it can and can't do**

- Bash is off unless allowed with `--allowedTools`.
- On an issue, it "always creates a new branch". It "creates commits on a branch and links back to a prefilled PR creation page".
  - The PR is opened by a person, unless the workflow gives Claude a tool that creates PRs, such as `Bash(gh pr create *)`.
  - That last step is my inference. Check it in a spike.
- It "cannot approve pull requests", "cannot submit formal GitHub PR reviews", and "cannot merge branches, rebase".

**Safety**

- The triggering user needs write access.
- Bot actors are rejected unless listed in `allowed_bots`, which prevents loops.

**CI interaction**

- Commits pushed with the default `GITHUB_TOKEN` don't trigger workflows. Let the action authenticate as the Claude GitHub App, which is the default, so that CI runs on Claude's pushes.
- With `actions: read`, Claude can read CI results.

**Review workflow**

- The documented example installs the `code-review` plugin and runs `/code-review:code-review --comment` on `pull_request` events. Findings are posted inline.
- On public repos, fork PRs get no secrets, so only same-repo branches are reviewed.

**Schedules**

- Run from the default branch only.
- "In public repositories, disables the schedule after 60 days without repository activity."

**Auth and cost**

- Auth uses either `ANTHROPIC_API_KEY` (per-token) or `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`. With the token, "runs use your Claude subscription instead of API billing."
- Actions minutes: "The use of standard GitHub-hosted runners is free" in public repositories ([GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). Rolegraph is public.

**Managed Code Review**

- Source: [Code Review](https://code.claude.com/docs/en/code-review).
- Team and Enterprise only.
- "A review never approves or blocks the pull request." Its check run "doesn't conclude as a failure."
- It reads code without building or running it.
- On a personal plan, use the action-based `/code-review` workflow instead.

### 5. Cloud sessions and scheduled tasks ("routines")

Sources: [Scheduled tasks](https://code.claude.com/docs/en/routines) and [Cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web).

**What a scheduled task is**

- Status: "Scheduled tasks are in research preview. Behavior, limits, and the API surface may change."
- Routines are now called scheduled tasks. `/schedule` and `/routines` still work in the CLI, and they're managed at claude.ai/code/routines.
- Available on Pro, Max, Ultra, Team and Enterprise.

**Triggers**

- A schedule, hourly at most.
- An API `POST /fire`, behind a beta header.
- GitHub events: pull requests, releases, and **issues** (opened, labeled, assigned and so on).
  - Filters are documented for PRs only.
  - "Claude Code doesn't reuse sessions across events."
- An `issue.labeled` trigger is a natural ticket intake.

**How a run behaves**

- Each run is a full cloud session in a VM, with a cached setup script and network allowlists.
- The repo is cloned fresh each run.
- "Claude pushes its work to a branch prefixed with `claude/`". Limit push targets with branch protection or rulesets.
- Runs start in **auto mode**. A run stops to wait for you only on ask rules, or after repeated classifier blocks.
- "Commits and pull requests carry your GitHub user", meaning the run acts as you.

**Limits and billing**

- Runs "draw down subscription usage the same way interactive sessions do."
- 100 scheduled runs per hour per account, and 30 manual or API fires per hour per task.
- GitHub webhook events have hourly caps. "Events beyond the limit are dropped."
- Cloud sessions in general: "no separate charge for the cloud VM". They share your plan's rate limits, and parallel sessions use them up proportionally.

**Related cloud features**

- `claude --cloud "<task>"` starts parallel cloud sessions from the terminal. Each one is independent, and you create the PR from claude.ai/code.
- **Auto-fix PRs**: a cloud session watches a PR. It pushes clear fixes for CI failures and review comments, and asks you when a comment is ambiguous.
  - It can't react to merge conflicts.
  - It needs the Claude GitHub App.

---

## Options compared

| | A. Local dispatcher + `claude -p` (or Agent SDK) | B. Interactive session + subagent-driven skill | C. `claude-code-action` in Actions | D. Cloud scheduled task / `--cloud` |
|---|---|---|---|---|
| **Ticket picking** | Script queries `gh issue list` by label and dependency order, then hands one issue per run | Human names the issue, or the skill picks the next ready one | Event-driven: a human adds a label or assignee, or a cron prompt picks one | `issue.labeled` GitHub trigger, schedule, or API fire |
| **Claiming** | Dispatcher is the single writer: swaps the label (`ready` to `in-progress`) and assigns before launch. No race with one dispatcher | Implicit, because a human drives it | Label is the claim. Add a workflow `concurrency` group to serialize | Label is the claim. One session per event. Hourly caps, and excess events are dropped |
| **Parallelism** | One `--worktree issue-N` per run. Clean up yourself | Subagents with `isolation: worktree`, or `/batch` | One runner per job, a fresh checkout each | One VM per session. Limited by plan rate limits |
| **TDD / coverage gating** | Project skill such as `/implement-ticket`, `tdd` skill, Stop hook running tests with a coverage floor. Needs non-`--bare` mode (or explicit `--settings`) | Strongest inner loop: implementer and reviewer subagents, ledger, Stop and SubagentStop hooks | Same skills and hooks after checkout. Bash must be allowed. Coverage enforced by separate CI jobs | Repo skills and hooks load from the clone. Setup script installs tooling |
| **Review gate** | Reviewer subagent in-session, plus the `/code-review` workflow on the PR | Per-task review and a final branch review built in | `/code-review --comment` workflow on `pull_request`. Advisory only | Separate PR-triggered task as a reviewer. Auto-fix answers comments |
| **Merge policy** | GitHub branch protection plus required checks. Human merge, or `gh pr merge --auto` | Same | Action cannot merge or approve. Same GitHub policy | Pushes only to `claude/*` by default. Same GitHub policy |
| **Cost / billing** | Subscription if logged in. API if `ANTHROPIC_API_KEY` is set (SDK: API key). `--max-budget-usd` per run | Subscription. Highest tokens per ticket because of reviewers and fix rounds | Free minutes on a public repo, plus subscription (`CLAUDE_CODE_OAUTH_TOKEN`) or API tokens. Cap with `--max-turns` and a job timeout | Subscription usage, no VM charge. Research preview |
| **Human in the loop** | Labels the issue ready, then reviews and merges the PR. Runs unattended in between (auto mode + `--permission-prompts none`) | Present all session. Stops only for irreversible, security or merge actions | Labels or comments to trigger, reviews and merges. Can steer with `@claude` comments on the PR | Labels to trigger, opens the run to answer blocked prompts, merges |
| **Main risks** | Runs on your laptop: needs it on, and repo hooks run untrusted. Worktree and port/data collisions | Needs an attended session, doesn't scale past one | Opening the PR may need an extra tool grant. Public-repo trigger safety. GITHUB_TOKEN doesn't trigger CI | Preview churn. Acts as your GitHub identity. Dropped events |

Things that apply whichever option is chosen:

- **Hard gates live in GitHub**:
  - Branch protection or a ruleset on `main`.
  - Required status checks for backend tests with `pytest --cov-fail-under=80` ("Fail if the total coverage is less than MIN", [pytest-cov](https://pytest-cov.readthedocs.io/en/latest/config.html)).
  - Required checks for frontend tests with Vitest `coverage.thresholds` ([Vitest](https://vitest.dev/config/coverage), which also supports `perFile`).
  - Auto-merge, if used, only merges "after all required reviews and status checks pass" ([GitHub](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request)). `gh pr merge --auto` enables it from a script ([gh manual](https://cli.github.com/manual/gh_pr_merge)).
- **"Meaningful" coverage** (the map's ≥80% bar) can't be enforced by a percentage. It needs a reviewer, a subagent or a human, that checks the tests assert behavior. Mutation testing could back this up but was not researched here.
- **Dependency order**: issues on this repo already carry `blocked-by` / `blocking` relations (see `gh issue view`). A dispatcher can skip issues with open blockers.

## Recommendation (input to #17, not a decision)

For a single-developer, public, localhost project, start with **A + B inside, GitHub CI as the gate**, and keep **D** as the later upgrade:

1. **Ticket contract**: give each implementation issue acceptance criteria and a test plan, labelled `ready-for-agent`. The dispatcher checks that it has no open `blocked-by`.
2. **Dispatcher**: a small script or repo skill. It picks the next ready issue, claims it (label `in-progress` plus assignee), and runs:
   - `claude -p "/implement-ticket <N>" --worktree issue-<N> --permission-mode auto --permission-prompts none --max-budget-usd <cap> --output-format json --json-schema <result schema>`
   - It runs under the subscription login. Skip `--bare`, because skills and hooks must load. Keep `ANTHROPIC_API_KEY` unset unless you want API billing.
3. **`/implement-ticket` skill**: follows the subagent-driven-development shape.
   - A `tdd` implementer subagent works red, green, refactor.
   - A reviewer subagent checks spec and test quality.
   - A ledger tracks progress.
   - It opens the PR with `gh pr create` and links `Closes #N`.
   - A Stop hook blocks finishing until the backend and frontend test and coverage commands pass locally.
4. **CI**: GitHub Actions runs tests and coverage as required checks on `main`. A `claude-code-action` `/code-review --comment` workflow on PRs gives an advisory second opinion.
5. **Merge**: a human merges at first. Turn on `gh pr merge --auto` per label once the gates have earned trust.
6. **Later**: when the loop is stable, move intake to a cloud scheduled task with an `issue.labeled` trigger, so it runs with the laptop closed, and use auto-fix for CI and review follow-ups.
   - Both are subscription-billed.
   - Watch the research-preview status and the hourly caps.

Option C as the primary runner is worth it only if runs must be visible on GitHub and tied to repo events. Its PR-creation and Bash grants need a spike first.

## Open questions for #17

- Subscription or API key for unattended runs, given the Agent SDK's claude.ai-login policy and plan rate limits?
- How should each worktree get its own data dir and port for rolegraph's embedded storage and dev servers?
- How many tickets run in parallel? This is limited by plan rate limits and merge-conflict risk on shared files such as `CONTEXT.md`.
- Which events need a human: every merge, or only label-gated risk classes such as schema migrations and export format changes?
- Does `claude-code-action` in automation mode open PRs directly when allowed `gh pr create`? Spike before relying on option C.
