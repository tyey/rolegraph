# The factory has its own GitHub user; a ruleset and CODEOWNERS guard `main`

ADRs 0015 and 0016 had both factory loops act as the developer's own GitHub user. That left GitHub unable to tell the factory from the human: any bypass the human had, the factory had too, and the risk classes were enforced only by a script and by hooks, which fail open. The factory now has **its own GitHub account**, which lets GitHub enforce the gates itself.

**The factory user.**

- A dedicated machine account (GitHub allows one free machine account per person), invited as a collaborator with the **Write** role. It can push branches, open PRs, label, and enable auto-merge. It can't change settings or rulesets, and it can't bypass them.
- The loops authenticate with a **classic PAT with only `repo` scope**. GitHub lets only classic PATs write to a public repo owned by another user. The PAT has **no `workflow` scope**, so GitHub rejects any push that changes `.github/workflows/`: a hard block behind ADR 0015's hook. The token has an expiry (90 days) and lives in a separate `GH_CONFIG_DIR` that only `./factory` uses. Commits use the factory user's noreply email. The Claude subscription login stays the developer's.
- A **factory PR** is a PR authored by the factory user. The loops ignore every other PR: the human's own PRs and Dependabot's.
- The reviewer also runs as the factory user, so it still can't approve: its verdict stays a label (ADR 0015). That is deliberate. A reviewer approving as the human would satisfy the code-owner review below and open the risk gate.

**Ruleset on `main`** (a repository ruleset, kept as JSON in the repo and applied with `gh api`):

- A pull request is required, with **0 required approvals** and **code-owner review required**. Stale approvals are dismissed on new commits, and the most recent push must be approved by someone other than its pusher.
- The required status check is **`ci`** (ADR 0017), in **strict** mode: the PR must be up to date with `main`.
- **Squash only**, required linear history, no force-pushes, no deletion.
- The **human (admin) may bypass, for pull requests only**. They can merge their own PR past a code-owner review they can't give themselves, or past a red `ci`. Direct pushes and force-pushes to `main` stay blocked for them too.
- Repo settings: auto-merge allowed, head branches deleted on merge, squash commits titled with the PR title and given the PR body as the message, so `Closes #N` and the summary are kept.

**CODEOWNERS is the risk-glob list.** `.github/CODEOWNERS` lists only ADR 0016's risk globs, each owned by the human, with a comment per class:

- migrations
- Backup/Restore and export formats
- `.github/**`
- the factory's scripts, skills and hooks, and `.claude/**`
- `docs/adr/**` and `CONTEXT.md`
- dependency manifests and lock files

Because code-owner review is required, a PR touching any of these can't merge without the human's approval, whatever a script or hook does. CODEOWNERS sits under `.github/**`, so it guards itself.

**Merge flow.** After a `review:approved` verdict, the review script:

- skips auto-merge and labels the PR `ready-for-human` if the ticket carries `risk:human-merge`
- otherwise runs `gh pr merge --auto --squash`, then reads `gh pr view --json reviewDecision`. If it is `REVIEW_REQUIRED`, a risk file was touched, and the script labels the PR `ready-for-human`. GitHub's own CODEOWNERS matcher decides, so the script can't disagree with the ruleset. For such a PR, the human's approval is the merge: auto-merge is already on.

A ticket therefore closes with no human action only when its factory PR is approved, touches no risk glob, has no `risk:human-merge`, and has a green, up-to-date `ci`.

**Keeping PRs up to date.** Strict mode blocks a PR that is behind `main`, and ADR 0017's `fresh` job gives it no CI.

- Before each pass, the review loop checks factory PRs for `mergeStateStatus` `BEHIND` and runs `gh pr update-branch --rebase`. This is a server-side rebase, pushed as the factory user, so CI runs again.
- If GitHub reports a conflict, the loop labels the PR `needs-rebase`. The implement loop then resumes that ticket's session (ADR 0015) to rebase locally, resolve the conflict, and push with `--force-with-lease`. The hook allows that only on the ticket's own branch, never on `main`.
- Being behind `main` doesn't count toward ADR 0015's 2-CI-failure cap.
- **A verdict survives an unchanged rebase.** The review script compares the `git patch-id` of the reviewed diff with the rebased one. If they match, it carries the verdict to the new head with a short comment. If they differ, because a conflict was resolved by hand, it removes the label and a fresh review runs.

**The test review checklist** (ADR 0008) lives in `.claude/skills/review-pr/checklist.md`, the one living copy, loaded by the `review-pr` skill. It sits under `.claude/**`, so the factory can't loosen its own checklist without the human's review. The verdict comment ticks each item with its finding.

## Considered Options

- **Keep acting as the developer's user** (ADRs 0015/0016), with no bypass for anyone. Rejected by the user in favour of a dedicated user: an admin bypass is useful for docs PRs, and a separate identity lets GitHub enforce what hooks alone can't.
- **The risk classes stay a script check**, with CODEOWNERS left as `* @tyey` and code-owner review not required. Rejected: a failed hook or a glob mismatch would let a risk PR auto-merge.
- **A separate `factory/risk-globs` file kept in sync with CODEOWNERS by a CI test.** Rejected: two lists to maintain, when GitHub's `reviewDecision` already says whether a risk glob matched.
- **Human review on every factory PR.** Rejected: it removes ADR 0016's low-risk path.
- **Merge-commit or rebase merging.** Rejected: both put the tester's red-test commits on `main`, where `git bisect` can land on them. With squash, every commit on `main` passed CI, and the TDD trail stays on the PR.
- **Admin bypass "always".** Rejected: direct pushes would change `main` with no PR record.
- **Requiring resolved review threads.** Rejected: the reviewer's inline comments would hold auto-merge until each thread was resolved, and the verdict label already carries the decision.
- **The implementer always rebases, or main is merged into the branch.** Rejected: every rebase would cost a session, or it wouldn't be the rebase the user asked for.
- **Re-review after every rebase, or never.** Rejected: a review for every move of `main`, or a hand-resolved conflict merging unread.
- **A fine-grained PAT.** Rejected: GitHub documents that only classic PATs can write to a public repo owned by another user.
- **A GitHub App.** Still rejected for v1 (ADR 0016): key handling and token minting on the laptop.
- **Narrowing the risk globs** (dropping `CONTEXT.md` and ADRs, or migrations). Rejected for now: early v1 tickets will often need the human's approval. The list is revisited after the first milestone, with data on how often each glob triggers.

## Consequences

- This supersedes ADR 0015's "both loops act as the developer's GitHub user" and ADR 0016's "branch protection requires no approving review". Risk PRs now need the human's code-owner approval, enforced by GitHub.
- Setting up the factory user is human work: create the account, invite it with Write, accept the invitation, mint the PAT. The backlog holds it as a HITL checklist.
- The PAT expires. When it does, the loops fail on their first `gh` call, which ADR 0015's failure rule turns into a stopped loop.
- The human's own PRs on risk files merge through the admin bypass. This includes every ADR and `CONTEXT.md` change.
- The labels the factory uses gain `main-red` (ADR 0017) and `needs-rebase`.
