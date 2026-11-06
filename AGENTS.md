# rolegraph

A personal, single-user tracker of interview processes, organised as a graph of roles. Backend: FastAPI (`backend/`). Frontend: React + TypeScript (`frontend/`). The domain glossary is [`CONTEXT.md`](CONTEXT.md). How to run the project is in [`README.md`](README.md).

## Agent skills

### Issue tracker

Issues live in GitHub Issues on tyey/rolegraph (`gh` CLI), including the wayfinder map and its sub-issues. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: a root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.
