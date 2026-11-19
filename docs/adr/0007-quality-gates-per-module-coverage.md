# Quality gates and per-module coverage

The map's bar is "≥80% meaningful coverage per module". It is met mechanically by the gates below and is the factory's definition of done. A change is done only when `./check` passes locally and the same gates pass in CI on the PR. Meaningfulness is covered by ADR 0008.

**Test levels.**

- Backend, laid out as `tests/<module>/{unit,application,integration,api}`:
  - domain unit tests: pure Python, no fixtures
  - application tests: use cases with a FakeUnitOfWork, an in-memory DocumentStore and a fake Clock
  - integration tests: a fresh real SQLite per test, for repositories, FTS5 triggers, recursive CTEs, `ON DELETE RESTRICT`, version conflicts and migrations
  - API tests: `TestClient(create_app(...))` on real SQLite
- Frontend:
  - Vitest unit tests in node for pure logic and the shared error mapper
  - every component and hook test in **Vitest Browser Mode** (Chromium), with MSW standing in for the API
- End to end: a few **Playwright journeys** on the real Vite and FastAPI with a throwaway data directory. A journey is added only when a ticket's acceptance criteria name one. Journeys don't count toward coverage.

**Coverage.**

- The whole suite runs once. Each module must reach **≥80% of lines and ≥80% of branches on its own**, so a well-tested module can't hide a weak one. The modules are the ten backend modules, the nine frontend features and `src/shared`. Any test may cover any module.
- Every backend `domain/` layer must also reach **≥90%**.
- How each side measures:
  - Backend: coverage.py with `branch = true` (sysmon core on Python 3.14). It has no per-directory threshold, so the report step runs `coverage report --include=<module> --fail-under` once per module.
  - Frontend: v8 coverage with Vitest glob `thresholds`. Each glob sets `lines` and `branches` itself, because globs don't inherit the global thresholds.
- Excluded from coverage:
  - generated and vendored code: `src/api/generated/`, `routeTree.gen.ts`, `main.tsx`, the shadcn/ui primitives in `src/shared/ui/`, and `*.d.ts`
  - Alembic `env.py` and the migration scripts, which the migration tests exercise instead
  - the usual `exclude_also` lines: `if TYPE_CHECKING:`, Protocol `...` bodies and `raise NotImplementedError`
- Any other `# pragma: no cover` or `/* v8 ignore */` must carry a one-line reason.

**Blocking checks.** The following block every merge:

- Backend:
  - `ruff check`
  - `ruff format --check`
  - mypy `strict` with the pydantic plugin
  - import-linter (layers and module order)
  - pytest with `strict = true` and `filterwarnings = ["error"]`
- Frontend:
  - oxlint, including the feature-order rules
  - `oxfmt --check`
  - `tsc -b`
  - Vitest
- Both sides:
  - per-module coverage and the mutation gate from ADR 0008
  - the Playwright journeys
- **Codegen drift**: regenerate `openapi.json`, the Orval client and `routeTree.gen.ts`, then fail on any git diff.
- **Migration drift**: `alembic check` passes, and `upgrade head` from an empty DB passes too. Migrations are **forward-only**, with no downgrades. The snapshot the app takes before `upgrade head` on startup is the rollback.

**One definition of the gates.** `backend/scripts/check`, `npm run check` in `frontend/`, and a root `./check` that runs both plus the Playwright journeys. CI calls exactly these scripts. `--quick` skips mutation and e2e for the inner loop. Each side prints one table of module × lines, branches, domain and mutation score with pass or fail. CI writes the table to `$GITHUB_STEP_SUMMARY` and uploads the HTML reports as artifacts.

## Considered Options

- **jsdom with Testing Library for plain components**, keeping Browser Mode only for React Flow. Rejected: two component environments and two sets of conventions for agents. React Flow needs a real DOM anyway.
- **Only each module's own tests count toward its coverage.** Rejected: it means one pytest and Vitest run per module, and it adds little once mutation testing checks the assertions.
- **Line coverage only.** Rejected: an `if` with no tested `else` would still count as covered.
- **Codecov or a sticky PR comment.** Rejected: a third-party service or a PR-write token, when the job summary is enough for one developer.
- **Reversible migrations tested up, down and up again.** Rejected: SQLite batch-mode downgrades are fiddly, and the startup snapshot already gives a rollback.
- **Dependency audit (pip-audit, npm audit) as a gate.** Not a gate in v1: it would block merges over advisories unrelated to the change.

## Consequences

- Real GitHub CI with branch protection on `main` must exist **before the factory runs for real**. Until then, a passing local `./check` is not proof that a change is done.
- Adding a module means adding its coverage threshold entries, as well as its import-linter contract and oxlint override.
