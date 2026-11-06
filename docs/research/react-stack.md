# Research: React stack for graph + timeline UI (2026)

Ticket: [#6](https://github.com/tyey/rolegraph/issues/6), part of the wayfinder map [#1](https://github.com/tyey/rolegraph/issues/1).
Researched: 2026-11-06. This doc records facts. Decisions come later, in their own tickets.

## Question

What is the current best-practice React 19 + Vite + TypeScript stack for an app whose two main views are:

- an **editable DAG of Roles**, where a Role can have several parents, and
- a **vertical timeline of Steps** for each Process?

The areas to cover are graph libraries, DAG auto-layout, server state, routing, forms and validation, components and styling, a typed API client generated from FastAPI's OpenAPI, and testing.

## Baseline (what the repo already has)

From `frontend/package.json`: `react`/`react-dom` ^19.3.1, `vite` ^8.3.6, `@vitejs/plugin-react` ^6.1.2, `typescript` ~7.0.2, `oxlint` ^1.90.0. The backend is FastAPI with `uv`.

Version and peer-dependency data below comes from the npm registry (`npm view <pkg> version peerDependencies`), queried on 2026-11-06.

## The one constraint that matters most: TypeScript 7 has no JS API

TypeScript 7.0 is the native Go port of the compiler. The [TS 7.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) says it "does not ship with an API", and a new, different API is expected in 7.1. I checked the published package: in `typescript@7.0.2`, the `"."` export (`lib/version.cjs`) exports only `version`. Everything else sits under `./unstable/*`.

So any tool that does `import ts from "typescript"` and calls `ts.factory` or `ts.SyntaxKind` at runtime **breaks** when it resolves to TS 7. Microsoft's workaround is npm aliases. You alias `typescript` to `npm:@typescript/typescript6` (which re-exports the 6.0 API and ships `tsc6`) and add `"@typescript/native": "npm:typescript@^7.0.2"` to get TS 7's `tsc` ([same post, "running side-by-side"](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0)).

What this means here:

- **Not affected:** Vite 8 / plugin-react (they transform with Oxc, not the TS API), Vitest, Playwright, oxlint, and runtime libraries. TS 7 only matters to tools that use the compiler API.
- **Affected:** OpenAPI codegen tools. See [Typed API client](#typed-api-client-from-fastapi-openapi). I checked their published `dist` for runtime `import ... from "typescript"`.

## Graph library (editable Role DAG)

| Library | Version | React 19 | Rendering | Fit for an *editor* |
|---|---|---|---|---|
| **React Flow** (`@xyflow/react`) | 12.12.1 | peer `react >=17` | DOM/SVG; nodes are React components | Built for node editors: custom nodes, handles, connect/drag/select, `colorMode`, typed node unions |
| **Cytoscape.js** (`cytoscape`, + `react-cytoscapejs` 2.0.0) | 3.34.4 | wrapper peer `react >=15` | Canvas | Built for visualisation and analysis. Nodes are styled with a stylesheet, not with HTML/React. Editing comes from extensions (edgehandles) |
| reagraph | 4.32.0 | peer `react >=16` | WebGL | Visualisation of large or 3D graphs, not editing |
| sigma + `@react-sigma/core` | 4.0.4 / 6.0.0 | peer `^18 \|\| ^19` | WebGL | Very large graphs (graphology), read-mostly |
| AntV G6 | 5.1.1 | n/a (framework-agnostic) | Canvas/WebGL | Feature-rich but heavy, with no React-first API |

Key facts:

- React Flow v12 lives at `@xyflow/react` with named imports. It adds `node.measured.{width,height}`, which layout code should read, plus `useNodesData`/`updateNodeData`, a `colorMode` of light/dark/system, and TS node-type unions ([v12 migration](https://reactflow.dev/learn/troubleshooting/migrate-to-v12)).
- React Flow has **no built-in auto-layout**. It documents plugging in a layout library ([Layouting](https://reactflow.dev/learn/layouting/layouting)).
- Cytoscape.js requires canvas and describes itself as a library for graph "visualisation and analysis". It ships layouts for dagre, ELK, cola, fCoSE and others as extensions ([js.cytoscape.org](https://js.cytoscape.org/)).
- Our data is a multi-parent DAG of Roles, and we want to edit it inline (create, connect, rename) and show React content in nodes. That matches React Flow's model directly. Cytoscape is the stronger choice only if we later need graph *algorithms* (it has BFS, centrality and similar built in) or thousands of nodes. A personal tracker will not get near that.

## DAG auto-layout

| Library | Version | Notes |
|---|---|---|
| **`@dagrejs/dagre`** | 3.1.3 (3.0 released 2026-03; ESM+CJS, bundled `.d.ts`) | Sugiyama layered layout. Synchronous, few options, fast. React Flow docs call it the simple choice and say it supports dynamic node sizes. The old unscoped `dagre` package is stuck at 0.8.5 (last touched 2022), so do not use it. |
| **`elkjs`** | 0.12.1 | Port of Eclipse ELK. Its flagship `layered` algorithm (Sugiyama) gives better crossing minimisation, ports and **edge routing**, and is the only listed option that does sub-flows and edge routing. It is asynchronous and can run in a Web Worker via `workerUrl` ([README](https://github.com/kieler/elkjs)). React Flow docs call it the most configurable and most complex option. |
| d3-hierarchy | n/a | Trees with **one root** only, and all nodes the same size. **Ruled out** because Roles have several parents. |
| d3-force | n/a | Physics layout. It does not express hierarchy, so it is the wrong shape for a DAG. |
| d3-dag | 1.3.0 | DAG-specific layered layouts (Sugiyama, zherebko, grid). Niche, and React Flow does not document it. |

Source for the trade-offs: [React Flow Layouting](https://reactflow.dev/learn/layouting/layouting). Both dagre and elkjs handle multi-parent DAGs, because layered layout is defined on DAGs, not trees. To route edges around nodes without ELK, React Flow points to a Pro example that uses `libavoid-js`.

## Server state

**TanStack Query** (`@tanstack/react-query`) 5.106.1, peer `react ^18 || ^19`. It is the default for server cache, mutations and invalidation, and both leading OpenAPI generators emit Query helpers (see below). TanStack Router's loaders are [designed for client-side data caches such as TanStack Query](https://tanstack.com/router/latest/docs/framework/react/overview).

## Routing

| Option | Version | Compat | Notes |
|---|---|---|---|
| **TanStack Router** (`@tanstack/react-router` + `@tanstack/router-plugin`) | 1.170.46 / 1.168.48 | React ≥18/19. Plugin peer `vite >=…\|\| >=8.0.0` | Types are fully inferred across paths, params, search and context. File-based routing comes from a Vite plugin. Search params are validated and typed, and `validateSearch` accepts Standard Schema libraries (Zod 4, Valibot, ArkType) directly ([search params guide](https://tanstack.com/router/latest/docs/framework/react/guide/search-params)). Loaders integrate with Query. |
| **React Router** (`react-router`) | 8.5.1 | peer `react >=19.2.7` | Has [three modes](https://reactrouter.com/home): declarative, data (`createBrowserRouter`, loaders/actions) and framework (Vite framework with typegen). Upgrading from v7 with future flags on is "generally non-breaking". Full type safety comes mainly from framework mode. |

For an SPA that talks to a separate FastAPI backend, TanStack Router gives end-to-end types without adopting a framework. React Router 8 in data mode is the more widely known alternative.

## Forms and validation

| Option | Version | Notes |
|---|---|---|
| **TanStack Form** (`@tanstack/react-form`) | 1.33.5, peer `react ^17\|\|^18\|\|^19` | "Natively supports all libraries following the Standard Schema specification", so Zod/Valibot/ArkType schemas go straight into `validators` with no adapter ([validation guide](https://tanstack.com/form/latest/docs/framework/react/guides/validation)). Type-safe fields. |
| **React Hook Form** + `@hookform/resolvers` | 7.91.0 + 7.0.3 | Most widely used. The resolvers peer covers `zod ^3.25 \|\| ^4`, `valibot ^1`, `arktype ^2` and more. shadcn/ui has form docs for it. |
| **Zod** | 4.6.7 | Implements Standard Schema in v4, so it works with TanStack Router, TanStack Form and RHF resolvers alike. |
| Valibot | 1.5.0 | Smaller, tree-shakeable alternative. |

The forms in this app are Role/Process/Step CRUD, so they are small. Either form library is fine. The real lever is reusing **generated Zod schemas** from the OpenAPI spec (both Hey API and Orval can emit them), so client validation follows the Pydantic models.

## Components and styling

| Option | Version | Notes |
|---|---|---|
| **Tailwind CSS** + `@tailwindcss/vite` | 4.3.5 | Plugin peer `vite ^5.2 \|\| ^6 \|\| ^7 \|\| ^8`. Setup in v4 is just `@import "tailwindcss";`. |
| **shadcn/ui** (CLI `shadcn` 4.23.0) | n/a | Copies source into your repo (`init -t vite`, `@/*` alias) ([Vite install](https://ui.shadcn.com/docs/installation/vite)). Since July 2026, **Base UI is the default primitive library**. Radix is "not being deprecated" and is selectable with `-b radix` ([changelog](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)). React Aria styles also exist. |
| Base UI (`@base-ui/react`) | 1.9.0 | Stable 1.x. Note that `@base-ui-components/react` is the old pre-1.0 name. |
| Radix (`radix-ui`) | 1.8.1 | Unified package. |
| Mantine (`@mantine/core`) | 9.7.5, peer `react ^19.2.0` | Batteries-included, styled components. A good fit if you would rather not own component code. |
| HeroUI | 3.2.7 | Built on React Aria plus Tailwind ≥4. |
| React Aria Components | 1.22.1 | Unstyled, the strongest accessibility story, more assembly needed. |

**Timeline view:** no dedicated library is needed. A vertical Step timeline is a semantic `<ol>` styled with Tailwind, which is more accessible and easier to test than a charting or timeline widget. React Flow brings its own CSS (`@xyflow/react/dist/style.css`) with CSS-variable theming, which can be matched to Tailwind tokens.

## Typed API client from FastAPI OpenAPI

FastAPI emits **OpenAPI 3.1**. Its [Generating SDKs](https://fastapi.tiangolo.com/advanced/generate-clients/) page uses **Hey API** and recommends a custom `generate_unique_id_function` (`f"{route.tags[0]}-{route.name}"`) for clean operation names. That applies whichever generator we pick.

| Tool | Version | Output | TS 7.0 status (verified) |
|---|---|---|---|
| **Hey API** (`@hey-api/openapi-ts`) | 0.99.0 (`next`: 0.0.0-next-20260930190945) | SDK plus a TanStack Query plugin (`queryOptions`, `mutationOptions`, query keys) ([plugin docs](https://heyapi.dev/openapi-ts/plugins/tanstack-query)), and a Zod plugin | **0.99.0 breaks** (`ts.SyntaxKind` undefined): [hey-api#4235](https://github.com/hey-api/hey-api/issues/4235), still open. Users report the `@next` prerelease works with TS 7.0.2, but that prerelease falls *below* the patched range of advisory GHSA-hhx9-57xq-r5rw, so Renovate flags it. Commenters there also raise single-maintainer and locked-PR concerns. |
| **openapi-typescript** + `openapi-fetch` + `openapi-react-query` | 7.13.0 / 0.17.0 / 0.5.4 | Types only, plus a tiny typed fetch and Query wrapper ("no codegen" codegen) | **Breaks** (`ts.factory` undefined): [openapi-typescript#2841](https://github.com/openapi-ts/openapi-typescript/issues/2841), open. Peer is `typescript ^5.x`. The workaround is the `@typescript/typescript6` alias, or `npx --package typescript@6`. |
| **Orval** | 8.46.0 | React Query hooks, fetch/axios client, **Zod schemas**, **MSW + Faker mocks** ([orval.dev](https://orval.dev/)) | `@orval/core` and `@orval/query` have no runtime `typescript` import (it is a devDependency only). The one TS 7 break, in the Hono generator, was [closed in 2026-10](https://github.com/orval-labs/orval/issues/4403). |

Workaround that fits any generator: keep TS 7 for `tsc -b` and alias the generator's `typescript` to `@typescript/typescript6`. Alternatively, run the generator in an isolated `npx --package typescript@6 …` call, since codegen is a dev-time step only.

## Testing

| Tool | Version | Compat | Notes |
|---|---|---|---|
| **Vitest** | 5.1.0 | peer `vite ^6.4 \|\| ^7 \|\| ^8`. **Node ≥22.12** | 5.0 ([post](https://vitest.dev/blog/vitest-5)) brought: inline projects inherit root plugins such as plugin-react, `clearMocks` defaults to `true`, Browser Mode trace view, and bounded-memory v8 coverage merge. |
| **Vitest Browser Mode** + `@vitest/browser-playwright` + `vitest-browser-react` | 5.1.0 / 2.3.0 | vitest-browser-react peer `vitest ^4 \|\| ^5`, `react ^18 \|\| ^19` | Stable since [Vitest 4](https://vitest.dev/blog/vitest-4). Provider packages include `@vitest/browser`. Runs component tests in a real Chromium. |
| **Testing Library** (`@testing-library/react`, `dom`, `user-event`, `jest-dom`) | 16.3.3 / 10.4.2 / 14.6.8 / 7.0.1 | RTL peer `react ^18 \|\| ^19` | Pair with jsdom 31.0.0 or happy-dom 21.0.4 for fast DOM tests. |
| **Playwright** (`@playwright/test`) | 1.65.0 | n/a | E2E against the real Vite + FastAPI. |
| **Coverage** `@vitest/coverage-v8` | 5.1.0 | n/a | v8 is the default provider. istanbul now uses `@vitest/istanbuljs`. |
| **MSW** | 3.0.4 | peer `vite >=6`, `typescript >=5.9.x` | Network-level API mocking. Orval can generate the handlers. |

React Flow specifically: its [testing guide](https://reactflow.dev/learn/advanced-use/testing) recommends **Playwright or Cypress**, because it must measure real DOM nodes before drawing edges. Under jsdom you have to mock `ResizeObserver`, `DOMMatrixReadOnly`, `offsetWidth/Height` and `getBBox`, and dragging (d3-drag) does not work. That argues for Vitest Browser Mode for graph component tests, even if jsdom plus RTL covers plain components.

## Adjacent notes

- **React Compiler:** the plugin-react README documents `react({ compiler: true })` (native Oxc, *experimental*) or `@rolldown/plugin-babel` with `reactCompilerPreset()` ([README](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md)).
- **Linting:** oxlint has native React hooks rules. ESLint JS plugins are supported through `jsPlugins` but are still **alpha**, and type-aware rules from JS plugins are not supported yet ([oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)).

## Recommendation (to feed later decisions)

| Area | Recommended | Runner-up |
|---|---|---|
| Graph | **React Flow `@xyflow/react` 12** | Cytoscape.js, if graph algorithms or scale ever matter |
| Layout | **`@dagrejs/dagre` 3** to start (sync, typed, simple) | `elkjs` in a Web Worker when crossings or edge routing get ugly |
| Server state | **TanStack Query 5** | n/a |
| Routing | **TanStack Router** (file-based via Vite plugin) | React Router 8, data mode |
| Forms / validation | **TanStack Form + Zod 4** (Standard Schema, same family as Router and Query) | React Hook Form + resolvers |
| UI / styling | **Tailwind 4 + shadcn/ui** (Base UI default). Timeline is a plain `<ol>` | Mantine 9 |
| API client | **Orval 8** (React Query hooks + Zod + MSW mocks, no TS-API runtime dependency) | Hey API, once TS 7 support ships in a stable, non-advisory release (FastAPI's own pick) |
| Testing | **Vitest 5** + RTL/jsdom for plain units, **Vitest Browser Mode** (Playwright provider) for React Flow components, **Playwright** E2E, **v8 coverage**, **MSW** | Happy-dom instead of jsdom |

Caveats for the decision tickets:

1. **Spike the API client first.** TS 7 is the live risk, and I verified the Orval claim only by inspecting the package, not by running it against our spec.
2. Vitest 5 needs Node ≥22.12, so pin Node in the repo (`.nvmrc` / `engines`).
3. The router and form choices are close calls between two good options. Pick for consistency (all-TanStack) or for familiarity (React Router / RHF).
