# The frontend mirrors the backend modules

`frontend/src/features/` has one folder per backend module: `catalog`, `roles`, `companies`, `agencies`, `people`, `documents`, `processes`, `search` and `exchange`. They depend on each other in the same one-way order as the backend (ADR 0002). Shared code lives in `src/shared/`, and the generated client lives in `src/api/generated/`. Views belong to the module that owns their data: the Timeline to `processes`, because a Process owns it, the Role graph to `roles`, and the Person view to `people`. This lets one factory ticket take a backend module and its frontend feature as a single vertical slice.

Each feature's **interface** is its `index.ts`. Other features import only from there, never from its files. The generated client is split by OpenAPI tag, and each backend router's tag is its module's name. A feature imports only its own tag's folder, so other modules' data reaches it only through that module's `index.ts`. Reads use the generated hooks and `queryOptions` directly. Writes go through feature hooks that own conflict (409) and validation (422) handling and optimistic updates.

**oxlint** enforces both rules with `no-restricted-imports`: a base pattern bans deep imports into any feature, and one override per feature bans imports from the modules above it. Both relative and `@/` alias imports are caught.

## Considered Options

- **Folders per screen** (`role-graph/`, `timeline/`, `person/`…). Rejected: they drift away from the backend modules and the glossary, and logic shared by two screens has no owner.
- **Layer-first folders** (`components/`, `hooks/`, `pages/`). Rejected for the same reason ADR 0002 rejected it on the backend: each feature is spread over several trees.
- **dependency-cruiser** to enforce the order. Rejected: version 18.7 supports TypeScript below 7 only. Under TS 7 it reported "0 modules cruised" and exited 0, so a CI check would pass silently.
- **Hand-written wrappers for every generated hook.** Rejected: one-to-one read wrappers are shallow pass-throughs. Only writes carry behaviour worth a feature hook.

## Consequences

- Adding a backend module means adding a feature folder and its oxlint override.
- Cache invalidation stays out of the feature hooks. After any successful write, the QueryClient invalidates everything, because Merge, Delete and Reclassify cut across modules.
- If dependency-cruiser or eslint-plugin-boundaries gains TS 7 support, it can replace the oxlint overrides without moving any files.
