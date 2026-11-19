# Research: mutation testing and per-directory coverage (2026)

Ticket: [#14](https://github.com/tyey/rolegraph/issues/14), part of the wayfinder map [#1](https://github.com/tyey/rolegraph/issues/1).
Researched: 2026-11-19. This doc records facts; the decisions are in ADRs 0007 and 0008.

## 1. Python
**mutmut 3.8.1** (28 Oct 2026), the current default choice. [PyPI](https://pypi.org/project/mutmut/), [HISTORY](https://github.com/boxed/mutmut/blob/main/HISTORY.rst)
- Supports Python 3.10 to 3.15, including 3.14 (the 3.14 segfault and deferred-annotation bugs [#457](https://github.com/boxed/mutmut/issues/457) and [#463](https://github.com/boxed/mutmut/issues/463) are closed). It depends on `pytest>=6.2.5`. The pytest 9.2 crash ([#615](https://github.com/boxed/mutmut/issues/615)) is fixed in 3.8.1, so pin `mutmut>=3.8.1`.
- Path restriction: `[tool.mutmut] source_paths=["src/"]`, `only_mutate=["src/rolegraph/*/domain/*"]`, `do_not_mutate`, and `mutate_only_covered_lines=true`. [Docs](https://mutmut.readthedocs.io/en/latest/)
- Incremental: results live in `mutants/`. Runs resume, and only functions whose source changed are retested. Known gaps: editing a test does not invalidate results ([#626](https://github.com/boxed/mutmut/issues/626)), and changing a callee does not retest its callers ([#597](https://github.com/boxed/mutmut/issues/597)). For CI, run a clean full pass or cache `mutants/`.
- Speed: it forks once per mutant and runs only the tests that cover it. The docs give no benchmarks. It needs `fork`, and on macOS there is a fork-safety issue ([#618](https://github.com/boxed/mutmut/issues/618)).
- CI threshold: there is no built-in fail-under. `mutmut export-cicd-stats` writes `mutants/mutmut-cicd-stats.json` (killed, survived, total, timeout, ...). A short script has to compare the score and fail.

**cosmic-ray 8.9.0** (10 Nov 2026) is maintained, but its classifiers stop at 3.13 (3.14 is not declared). It has a session/DB workflow with `cr-filter-git`/`-pragma`/`-lines`, and `cr-rate --fail-over` gives a built-in CI gate on the survival rate. It is heavier to set up. [PyPI](https://pypi.org/project/cosmic-ray/), [pyproject](https://github.com/sixty-north/cosmic-ray/blob/master/pyproject.toml)

**mutatest** is dead (last release 2022). Newer tools such as pytest-gremlins and irradiate are young and back their performance claims only with their own benchmarks. [Comparison](https://pytest-gremlins.readthedocs.io/en/latest/guide/comparison/)

## 2. StrykerJS 10.1.1 (23 Oct 2026)
[Releases](https://github.com/stryker-mutator/stryker-js/releases)
- The instrumenter is Babel 8 based (`@babel/preset-typescript`) and does not use the TypeScript API. [package.json](https://github.com/stryker-mutator/stryker-js/blob/master/packages/instrumenter/package.json)
- TS7 caveat: core's tsconfig preprocessing calls the TS6 API (`ts.parseConfigFileTextToJson`) and crashes under TS7 ([#6110](https://github.com/stryker-mutator/stryker-js/issues/6110), [#6111](https://github.com/stryker-mutator/stryker-js/issues/6111); fix PR [#6231](https://github.com/stryker-mutator/stryker-js/pull/6231) is still open). There are two workarounds: alias `typescript` to `@typescript/typescript6` for Stryker, or point `tsconfigFile` at a file that does not exist (fine with the Vitest runner).
- The typescript-checker has experimental TS7 support behind `experimentalNativePreview`. It needs TS7 installed as `@typescript/native` and TS6 installed as `typescript`, and it supports neither project references nor mutant grouping ([#6099](https://github.com/stryker-mutator/stryker-js/pull/6099)). The simplest option is to skip the checker.
- vitest-runner: Vitest 5 support landed in 10.1.0 (peer dependency `vitest>=2`). The docs still say Browser Mode "is not supported" ([docs](https://stryker-mutator.io/docs/stryker-js/vitest-runner/)). However, the repo has a Playwright browser-mode integration test ([fixture](https://github.com/stryker-mutator/stryker-js/tree/master/packages/vitest-runner/testResources/browser-project)), and browser bugs are open ([#6233](https://github.com/stryker-mutator/stryker-js/issues/6233), [#5458](https://github.com/stryker-mutator/stryker-js/issues/5458)). Treat it as unofficial and verify it on this repo.
- `mutate` takes globs, `!` exclusions and `file:5-7` line ranges. If the score falls below `thresholds.break`, Stryker exits with code 1. `--incremental` stores `reports/stryker-incremental.json`, and the Vitest runner gives full test-change detection. [Config](https://stryker-mutator.io/docs/stryker-js/configuration/), [Incremental](https://stryker-mutator.io/docs/stryker-js/incremental/)

## 3. Per-directory coverage
- Vitest 5.1.1: `coverage.thresholds: { 'src/features/roles/**': { branches: 80 } }` is valid. Global thresholds are not inherited by globs, the matched files still count toward the global numbers, and `perFile` must be set on each glob. If a threshold fails, Vitest logs `ERROR: Coverage for ...` and sets `process.exitCode = 1`. [Docs](https://vitest.dev/config/coverage), [source](https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/node/coverage.ts)
- coverage.py 7.17.3: `fail_under` is still global only. The usual approach is one `coverage report --include='src/rolegraph/x/*' --fail-under=N` per directory; each one exits with code 2 on failure. [Config](https://coverage.readthedocs.io/en/latest/config.html)
