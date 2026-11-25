# One CI workflow: a freshness gate, parallel `./check` jobs, one required `ci` check

GitHub Actions runs the quality gates of ADRs 0007 and 0008 and publishes the image of ADR 0009. Everything lives in one workflow, `.github/workflows/ci.yml`. Its jobs call exactly the `./check` scripts, so CI and the laptop can't disagree about what "done" means.

**Triggers.** `pull_request` to `main`, `push` to `main`, `push` of `vX.Y.Z` tags, and `workflow_dispatch`. A newer push to a PR cancels that PR's older run (`concurrency` per ref, `cancel-in-progress` on PRs only). Runs on `main` are never cancelled.

**Jobs.**

1. **`fresh`** runs first and fails fast if the PR head doesn't contain `main`'s tip (`git merge-base --is-ancestor origin/main <head>`). Every other job `needs` it, so a PR that is behind `main` gets no CI. It must be rebased first (ADR 0018).
2. Then, in parallel:
   - **`backend`**: `backend/scripts/check` without its mutation part
   - **`mutation`**: the same script, mutation part only, as a full clean mutmut run (ADR 0008)
   - **`frontend`**: `npm run check` in `frontend/`
   - **`e2e`**: root `./check`'s own part, which is codegen drift plus the Playwright journeys
   - **`image`**: builds the root `Dockerfile` without pushing, starts the container and checks `GET /api/health`, so a broken image can't merge
3. **`ci`** `needs` all of them, runs with `if: always()`, and fails unless every one succeeded (a skipped or cancelled job counts as a failure). **`ci` is the only required check.** Adding, renaming or splitting jobs therefore never touches the ruleset, and the factory's review loop polls one stable name.

Each check job writes its module table to `$GITHUB_STEP_SUMMARY` and uploads its HTML reports, plus Playwright traces when it fails, as artifacts kept for 14 days. Every job sets `timeout-minutes`.

**Runner and caches.**

- Every job runs on **`ubuntu-24.04`**, pinned rather than `-latest`. This is also the Linux that mutmut needs.
- Python comes from a committed `.python-version` (3.14) through `astral-sh/setup-uv` with `enable-cache` keyed on `uv.lock`, then `uv sync --locked`.
- Node comes from a committed `.nvmrc` through `actions/setup-node` with `cache: npm`, then `npm ci`.
- Playwright's Chromium, also used by Vitest Browser Mode, is cached at `~/.cache/ms-playwright`, keyed on the installed Playwright version. `playwright install-deps` still runs on every job.
- mutmut has no cache: ADR 0008 asks for a clean run.
- Docker layers use the `type=gha` cache.

**Publishing to GHCR** (linux/amd64; the tags are ADR 0009's):

- **Push to `main`**: a `publish` job runs after `ci` succeeds. It builds and pushes `:main` and `:sha-<short>`.
- **`vX.Y.Z` tag**: no rebuild. `docker buildx imagetools create` adds `:vX.Y.Z` and `:latest` to the existing `:sha-<short>` image, so a release is exactly the bytes CI tested. A tag on a commit with no `:sha-` image fails the job.
- The package `ghcr.io/tyey/rolegraph` is **public**, so the home server pulls without a login. The image holds only public code, never data.

**A red `main` files one fix issue.** When `ci` fails on a push to `main`, a last job uses `GITHUB_TOKEN` (`issues: write`) to open an issue titled `main is red`, or to comment on the open one. It includes the run link, the failing jobs and the commit, and carries the labels `ready-for-agent` and `main-red`. There is never more than one such issue. The implement loop takes a `main-red` issue before any other ticket, even while a factory PR is open. Filing works with the laptop off.

**Supply chain and permissions.**

- Every `uses:` pins a full commit SHA with the version in a comment.
- `.github/dependabot.yml` opens weekly grouped PRs for `github-actions`, `uv` and `npm`. They touch `.github/**` or lock files, which are risk globs, so the human merges them (ADR 0018). The factory loops ignore them.
- The workflow's default `GITHUB_TOKEN` is read-only. Only `publish` asks for `packages: write`, and only the red-`main` job asks for `issues: write`. Both run only on pushes to `main` or on tags.
- CI uses `pull_request`, never `pull_request_target`, and the repo requires approval before workflows run for any outside contributor's fork PR. That matches CONTRIBUTING.md: outside PRs aren't accepted.

## Considered Options

- **One job running root `./check`.** Rejected: wall time is the sum of every gate, mutation included.
- **Every parallel job as its own required check.** Rejected: each job rename or new job means editing the ruleset, and the review loop would poll several names.
- **PRs may merge while behind `main`, and `main` re-runs CI after the merge.** Rejected by the user: `main` could go red from two PRs that pass separately. The freshness gate and strict mode (ADR 0018) keep `main` green instead. A merge queue was also rejected: it is built for many parallel PRs, and the factory has one ticket in flight.
- **Rebuilding the image on a release tag.** Rejected: a release could differ from the tested `:sha-` image.
- **Publishing only on tags.** Rejected: it changes ADR 0009, and a factory merge couldn't be pulled for a quick smoke test on the server.
- **Both loops pause while `main` is red, and the human fixes it.** Rejected for a CI-filed fix ticket that the factory takes first.
- **`ubuntu-latest`, downloading browsers on every run, or a CI container image.** Rejected: the runner can change underneath, about a minute of downloads per browser job, or another image to maintain.
- **Major-tag action references with no update bot.** Rejected: a moved or compromised tag would run with `packages: write`.
- **A private package.** Rejected: the server would need a PAT that expires.

## Consequences

- `backend/scripts/check` needs a way to run its mutation part separately, and root `./check` a way to run only its own part (drift and e2e), so the CI jobs can call them.
- `backend/pyproject.toml` declares `requires-python = ">=3.12"`. It must follow `.python-version` to 3.14.
- A PR that is red only because it is behind `main` is not a CI failure for the factory's cap (ADRs 0015, 0018).
- ADR 0015's "one ticket in flight" gains one exception: a `main-red` fix runs even while a factory PR is open.
