# Mutation testing makes coverage meaningful

A coverage percentage counts lines that ran, not whether any test would notice if they were wrong. "Meaningful" coverage is therefore enforced by **mutation testing where the rules live**, plus a short review checklist.

- **Backend: mutmut (≥3.8.1) on every `domain/` layer, blocking.** Each module must reach a score of **≥80%**, where the score is killed / (killed + survived). CI does a full clean run, because mutmut's incremental cache misses changes to tests. mutmut has no fail-under of its own, so a small script reads `mutmut export-cicd-stats` and fails the job. Mutmut has an open macOS fork bug, so CI runs it on Linux.
- **Frontend: StrykerJS on the features' pure-logic files**, run by their node Vitest tests and not in Browser Mode. It is **advisory** until StrykerJS supports TypeScript 7 natively. Until then it runs with a dummy `tsconfigFile` and without the typescript-checker. Once that support lands, it blocks at **≥80%** per feature.
- **Equivalent mutants** are marked with `# pragma: no mutate` or `// Stryker disable`, each with a reason.
- **Review checklist.** The reviewer subagent and then the human check:
  1. every acceptance criterion in the ticket has a test that would fail without the change
  2. tests assert outcomes (returned values, state, the HTTP body, what the user sees), not only calls or mocks
  3. test names use the terms in `CONTEXT.md`
  4. every coverage and mutation exclusion has a reason that holds
  5. each rule is proven at the lowest level that can prove it: domain before application, before API, before e2e

## Considered Options

- **Mutation testing advisory only**, with the checklist as the only gate. Rejected: nothing mechanical would catch tests that assert nothing, which is the failure mode an agent-driven factory is most likely to produce.
- **Mutating the whole codebase.** Rejected: slow, and the application, infrastructure and API layers are mostly wiring, which the integration and API tests check better.
- **cosmic-ray.** Rejected for now: it has a built-in rate gate, but its metadata lists Python only up to 3.13, and it takes more setup than mutmut.
- **Thresholds of 70% or 90%.** 80% matches the coverage bar. On pure domain rules, most surviving mutants are real gaps.
