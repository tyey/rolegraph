# Research: FastAPI DDD project conventions (2026)

Ticket: [#5](https://github.com/tyey/rolegraph/issues/5). Part of the [wayfinder map](https://github.com/tyey/rolegraph/issues/1).
Feeds: [#11 Backend architecture & persistence](https://github.com/tyey/rolegraph/issues/11), [#14 Quality gates](https://github.com/tyey/rolegraph/issues/14).
Researched: 2026-11-06. This note gathers facts and compares options. It decides nothing; the grilling tickets do that.

## Question

What does current best practice look like for a FastAPI project built with DDD / hexagonal architecture? The note covers:

- module layout per bounded context
- domain, application and infrastructure layers
- dependency injection
- sync vs async with an embedded DB
- Pydantic v2 API schemas vs domain models
- the uv + ruff + mypy/pyright toolchain
- pytest patterns: fixtures, test DB, TestClient/httpx, branch coverage per module

Rolegraph context: one user, localhost only, no auth, embedded storage (choice pending in [#4](https://github.com/tyey/rolegraph/issues/4); SQLite is assumed below as the likely candidate), ≥80% meaningful coverage per module, and the code is also a learning base.

## Versions in play (PyPI, 2026-11-06)

| Package | Latest | Released | Notes |
|---|---|---|---|
| fastapi | 0.162.0 | 2026-10-23 | rolegraph lock is already on this. Requires `pydantic>=2.9`, so Pydantic v1 support is gone ([pyproject](https://github.com/fastapi/fastapi/blob/master/pyproject.toml)) |
| starlette | 1.10.0 | 2026-10-24 | 1.x line since May 2026 ([releases](https://github.com/Kludex/starlette/releases)) |
| pydantic | 2.14.3 | 2026-11-05 | |
| pydantic-settings | 2.16.2 | 2026-10-28 | |
| SQLAlchemy | 2.1.8 | 2026-11-04 | 2.1 requires Python ≥3.11 |
| sqlmodel | 0.0.48 | 2026-10-06 | still 0.0.x |
| alembic | 1.20.1 | 2026-10-22 | |
| aiosqlite | 0.22.1 | 2025-12-23 | |
| httpx | 0.28.1 | (2024) | effectively frozen; see httpx2 |
| httpx2 | 2.16.0 | 2026-10-21 | Pydantic-maintained continuation of httpx |
| uv | 0.13.7 | 2026-11-03 | |
| ruff | 0.17.4 | 2026-11-05 | rolegraph lock is on this |
| mypy | 2.4.1 | 2026-10-28 | 2.x line |
| pyright | 1.1.414 | 2026-09-10 | |
| ty (Astral) | 0.0.99 | 2026-11-06 | beta |
| pyrefly (Meta) | 1.4.1 | 2026-11-05 | stable since 1.0 |
| pytest | 9.2.0 | 2026-10-27 | rolegraph lock is on this |
| pytest-cov / coverage | 7.1.0 / 7.17.2 | 2026-03 / 2026-11 | |
| pytest-asyncio / anyio | 1.4.1 / 4.16.0 | 2026-11 | |
| dishka | 1.10.1 | 2026-04-25 | DI container |
| dependency-injector | 4.49.1 | 2026-06-18 | DI container |
| svcs | 26.2.0 | 2026-08-24 | service locator |

Rolegraph currently pins Python 3.13 (`backend/.python-version`). The FastAPI full-stack template has moved to `requires-python = ">=3.14"` ([pyproject](https://github.com/fastapi/full-stack-fastapi-template/blob/master/backend/pyproject.toml)).

## Key facts

### FastAPI (official docs and release notes)

- **Structure.** The docs show one `APIRouter` per feature module, a shared `dependencies.py`, and `app.include_router(...)` with `prefix`, `tags` and `dependencies`. They recommend declaring the app location in `pyproject.toml` so `fastapi dev`, the VS Code extension and other tools can find it: `[tool.fastapi] entrypoint = "app.main:app"`. ([Bigger Applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/))
- **Routers are no longer copied (0.137.0, 2026-06-14).** An included router keeps its `APIRouter`/`APIRoute` objects as a tree. Routes added after inclusion now take effect, and `router.routes` is officially an internal detail. The release notes list per-router dependencies, exception handlers and middleware as "future features enabled". This favours one router per bounded context. ([0.137.0 release](https://github.com/fastapi/fastapi/releases/tag/0.137.0))
- **`def` vs `async def`.** A plain `def` path operation or dependency "is run in an external threadpool that is then awaited". The docs' rule: use `def` with libraries that don't support `await`, and if in doubt use `def`. Blocking I/O inside `async def` blocks the event loop. ([Concurrency and async/await](https://fastapi.tiangolo.com/async/))
- **Dependencies with `yield` and `scope`.** Code after `yield` runs after the response is sent by default (`scope="request"`). `Depends(..., scope="function")` runs teardown after the handler returns but *before* the response is sent. A dependency that catches an exception must re-raise it, or the client gets a 500 and the server logs nothing. ([Dependencies with yield](https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/)) This matters for a unit-of-work dependency: with `scope="function"`, a commit failure surfaces as an error response instead of happening after a 200 has already gone out.
- **`Annotated` is the documented style** (`SessionDep = Annotated[Session, Depends(get_session)]`) ([SQL Databases](https://fastapi.tiangolo.com/tutorial/sql-databases/)). Ruff enforces it with `FAST002` ([ruff rules](https://docs.astral.sh/ruff/rules/)).
- **Lifespan replaces `on_event`.** The `on_event` startup/shutdown API sits under "Alternative Events (deprecated)" ([Lifespan Events](https://fastapi.tiangolo.com/advanced/events/)). The SQL tutorial still shows `@app.on_event("startup")`, so don't copy it as-is.
- **The official SQL tutorial uses SQLModel.** One `Hero` table model, plus `HeroCreate`/`HeroPublic`/`HeroUpdate` variants and `model_dump(exclude_unset=True)` for partial updates, with sync `def` endpoints and `check_same_thread=False` on SQLite ([SQL Databases](https://fastapi.tiangolo.com/tutorial/sql-databases/)). This is CRUD-first, not DDD (see the Pydantic section).
- **Request-body semantics changed in October 2026.** 0.151.0 "Distinguish JSON null from omitted body values", and 0.147–0.162 reworked defaults for form and parameter models. This bears on PATCH semantics. ([releases](https://github.com/fastapi/fastapi/releases))
- **Overriding dependencies in tests.** `app.dependency_overrides[original] = replacement`, reset with `app.dependency_overrides = {}`. The override applies wherever the dependency is used, including router-level dependencies. ([Testing Dependencies](https://fastapi.tiangolo.com/advanced/testing-dependencies/))

### TestClient now prefers httpx2

- Starlette PR [#3291](https://github.com/Kludex/starlette/pull/3291) (merged 2026-05-25): `starlette.testclient` "now prefers `httpx2` when installed, falling back to `httpx`. The fallback emits a `StarletteDeprecationWarning`."
- [httpx2](https://github.com/pydantic/httpx2) is Pydantic's continuation of HTTPX, with the same API under a new import name. Its README says HTTPX itself is "seeing limited activity recently". FastAPI 0.143.4 added `httpx2` to its optional dependencies ([release](https://github.com/fastapi/fastapi/releases/tag/0.143.4)).
- **Verified locally.** `uv run pytest` on the current rolegraph backend (httpx 0.28.1, Starlette 1.10.0) passes, with this warning: `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead.` The FastAPI testing tutorial still says `uv add httpx` ([Testing](https://fastapi.tiangolo.com/tutorial/testing/)), so the docs lag the code here.

### DDD / hexagonal in Python: primary references

- **[Architecture Patterns with Python ("Cosmic Python")](https://www.cosmicpython.com/)** by Percival & Gregory, free online. It is still the canonical Python DDD text. Its layers are `domain`, `service_layer`, `adapters`, `entrypoints`, under `src/`, with `tests/{unit,integration,e2e}` ([Appendix: project structure](https://www.cosmicpython.com/book/appendix_project_structure)). Its main patterns:
  - Repository and unit of work ([ch. 2](https://www.cosmicpython.com/book/chapter_02_repository), [ch. 6](https://www.cosmicpython.com/book/chapter_06_uow)).
  - Tests built on fakes such as `FakeRepository` ([ch. 3](https://www.cosmicpython.com/book/chapter_03_abstractions)).
  - A `bootstrap.py` composition root with manual DI. The book says "bootstrap script is just fine for our purposes" ([ch. 13](https://www.cosmicpython.com/book/chapter_13_dependency_injection)).
  - Its examples use Flask and SQLAlchemy *imperative* mapping. The [code repo](https://github.com/cosmicpython/code) was last pushed 2025-06.
- **SQLAlchemy imperative mapping** (`registry.map_imperatively(DomainClass, table)`) maps plain domain classes without making them inherit from an ORM base. This is how a domain stays persistence-ignorant while still using the ORM's unit of work and identity map ([Mapping styles](https://docs.sqlalchemy.org/en/21/orm/mapping_styles.html)).
- **Reference repos**, checked on GitHub 2026-11-06:

| Repo | ★ | Last push | What to take from it |
|---|---|---|---|
| [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template) | 46k | 2026-11-03 | The official reference for **toolchain**: uv, ruff, `mypy strict = true` *and* `ty`, `coverage` with `dynamic_context = "test_function"`, `[tool.fastapi] entrypoint`, `TestClient` fixtures in `conftest.py`. Layout is flat (`api/`, `core/`, `models.py`, `crud.py`) with SQLModel. **Not DDD.** |
| [zhanymkanov/fastapi-best-practices](https://github.com/zhanymkanov/fastapi-best-practices) | 18k | 2026-08-27 | **Package per domain** (`src/<domain>/{router,schemas,models,service,dependencies,exceptions,config}.py`), aliased cross-domain imports, `BaseSettings` split per domain, dependencies used for validation, async test client from day 0. Feature-sliced rather than layered. |
| [ivan-borovets/fastapi-clean-example](https://github.com/ivan-borovets/fastapi-clean-example) | 0.6k | 2026-10-23 | The most complete **clean/hexagonal FastAPI** example that is maintained in 2026. `core/` (entities, value objects, commands, queries, ports), `inbound/http`, `outbound/` (adapters, `persistence_sqla/mappings` using imperative `Table` + mapping), `main/ioc` (dishka). Enforces layers with **import-linter** contracts. Uses mypy strict + pydantic plugin, pytest-asyncio `auto`, coverage `core = "sysmon"`. The README says a refactor is in progress. |
| [cosmicpython/code](https://github.com/cosmicpython/code) | 2.7k | 2025-06 | Chapter-by-chapter branches of the book's patterns (Flask, but the patterns carry over). |
| [pgorecki/python-ddd](https://github.com/pgorecki/python-ddd) | 1k | 2025-01 | Modular monolith with per-module DDD. Older. |
| [Netflix/dispatch](https://github.com/Netflix/dispatch) | 6.5k | archived | Often cited as a large FastAPI example. **Archived**, so don't use it. |

### Embedded DB (SQLite) facts that drive the sync/async choice

From the [SQLAlchemy 2.1 SQLite dialect docs](https://docs.sqlalchemy.org/en/21/dialects/sqlite.html):

- **The async driver is threads underneath.** "aiosqlite is a wrapper around pysqlite that uses a background thread for each connection". SQLite has no socket I/O to make non-blocking.
- **Pooling.** File databases use `QueuePool` when sync, and `AsyncAdaptedQueuePool` when async (since 2.0.38). `check_same_thread=False` is set automatically for file databases.
- **Foreign keys are off by default.** `PRAGMA foreign_keys = ON` must run on every connection, through a `connect` event listener.
- **Transactions.** pysqlite's legacy transaction mode breaks SERIALIZABLE isolation and SAVEPOINTs: a SAVEPOINT before BEGIN "fails to participate in the enclosing transaction". On Python 3.12+ the fix is `connect_args={"autocommit": False}`, which also works with `create_async_engine` and aiosqlite. Legacy mode stays the default until Python 3.16. This matters for rollback-per-test fixtures.

From the [SQLAlchemy asyncio docs](https://docs.sqlalchemy.org/en/21/orm/extensions/asyncio.html) and the [2.1 migration notes](https://docs.sqlalchemy.org/en/21/changelog/migration_21.html):

- Under `AsyncSession`, lazy loads and expired-attribute access fail ("no implicit IO is allowed"). The workarounds are `AsyncAttrs.awaitable_attrs`, `lazy="raise"` plus eager loading (`selectinload`), and `expire_on_commit=False`. One `AsyncSession` must not be shared across concurrent tasks.
- In 2.1, `greenlet` is no longer installed by default. Async users install `sqlalchemy[asyncio]`.

### Pydantic v2 (official docs)

- `ConfigDict(from_attributes=True)` lets `Model.model_validate(obj)` read *arbitrary objects*: ORM rows, dataclasses, plain domain entities. It was formerly called "ORM mode". ([Models: arbitrary class instances](https://pydantic.dev/docs/validation/latest/concepts/models/))
- Other relevant features: `extra="forbid"`, `frozen=True`, [strict mode](https://pydantic.dev/docs/validation/latest/concepts/strict_mode/), [Pydantic dataclasses](https://pydantic.dev/docs/validation/latest/concepts/dataclasses/) (validation on stdlib-like dataclasses) and [pydantic-settings](https://pydantic.dev/docs/validation/latest/concepts/pydantic_settings/).
- The mypy plugin (`plugins = ["pydantic.mypy"]`, with `init_forbid_extra`, `init_typed`, `warn_required_dynamic_aliases`) synthesises typed `__init__` signatures ([mypy integration](https://pydantic.dev/docs/validation/latest/integrations/dev-tools/mypy/)). Pyright needs no plugin.

### Toolchain facts

- **uv.** Dev tools go in the PEP 735 `[dependency-groups]` table. "the dev group is synced by default". Extra groups (e.g. `lint`, `typecheck`) can be toggled with `--group`/`--no-group`. ([uv: dependencies](https://docs.astral.sh/uv/concepts/projects/dependencies/)) A packaged app with a `src/` layout comes from `uv init --package` ([uv: creating projects](https://docs.astral.sh/uv/concepts/projects/init/)). Monorepo option: [uv workspaces](https://docs.astral.sh/uv/concepts/projects/workspaces/).
- **ruff.** One tool for both lint and format ([configuration](https://docs.astral.sh/ruff/configuration/)). Relevant rule families:
  - FastAPI rules: `FAST001` redundant `response_model`, `FAST002` non-`Annotated` dependency, `FAST003` unused path param.
  - `PT` (pytest style), `TID` (banned APIs and relative imports), `B`, `UP`, `SIM`, `RUF`.
  - The full-stack template selects `E,W,F,I,B,C4,UP,ARG001,T201`. The clean example goes much further, adding `PT`, `TID` banned-api, and strictly-empty `__init__` modules.
- **mypy 2.x.** 2.0 turned on `--local-partial-types` and `--strict-bytes` by default and added experimental parallel checking (`-n N`) ([CHANGELOG](https://github.com/python/mypy/blob/master/CHANGELOG.md)). `strict = true` is what both the official template and the clean example use.
- **pyright** has `strict` mode ([configuration](https://microsoft.github.io/pyright/#/configuration)), needs no plugins, and works with Pydantic and SQLAlchemy 2 `Mapped[...]` through standard typing features.
- **ty** is "currently in beta" with 0.0.x versioning and no stable API yet ([README](https://github.com/astral-sh/ty)). The official template runs it *alongside* mypy (`[tool.ty.terminal] error-on-warning = true`).
- **pyrefly** (Meta) says its development status is stable, at 1.x ([README](https://github.com/facebook/pyrefly)).
- **import-linter** enforces architecture as contracts:
  - `layers` (with `containers` to repeat one layer stack inside every context)
  - `independence` (contexts don't import each other)
  - `forbidden`, `acyclic_siblings`, `protected`

  ([layers](https://import-linter.readthedocs.io/en/stable/contract_types/layers/), [independence](https://import-linter.readthedocs.io/en/stable/contract_types/independence/))

### pytest and coverage facts

- **pytest 9.**
  - Native TOML config in `[tool.pytest]` (since 9.0). `[tool.pytest.ini_options]` still works ([configuration](https://docs.pytest.org/en/stable/reference/customize.html)).
  - `strict = true` turns on every strictness option, and the docs recommend it "if you can".
  - For new projects: "we recommend to use `importlib` import mode".
  - The `src` layout is strongly recommended.

  ([Good practices](https://docs.pytest.org/en/stable/explanation/goodpractices.html))
- **Sync tests:** `TestClient`, with plain `def` tests ([Testing](https://fastapi.tiangolo.com/tutorial/testing/)). Using `with TestClient(app) as c:` runs lifespan; the official template's `client` fixture does this.
- **Async tests:** `httpx.AsyncClient(transport=ASGITransport(app=app))` with `@pytest.mark.anyio`. Warning: "the AsyncClient won't trigger these events [lifespan]", so wrap the app with `asgi-lifespan`'s `LifespanManager` ([Async Tests](https://fastapi.tiangolo.com/advanced/async-tests/)). pytest-asyncio 1.x with `asyncio_mode = "auto"` is the alternative the clean example uses.
- **Test database.** SQLModel's FastAPI testing tutorial overrides `get_session` with a session bound to an in-memory SQLite engine (`sqlite://` + `StaticPool`), then calls `dependency_overrides.clear()` ([SQLModel: test applications](https://sqlmodel.tiangolo.com/tutorial/fastapi/tests/)). The official template instead uses a session-scoped real DB and deletes rows at teardown.
- **Coverage.py** ([config](https://coverage.readthedocs.io/en/latest/config.html), [branch](https://coverage.readthedocs.io/en/latest/branch.html)):
  - `[tool.coverage.run] branch = true` measures branches. `# pragma: no branch` marks intentionally partial branches.
  - `exclude_also` adds patterns without dropping the defaults.
  - `fail_under` sets the threshold, and it is **global**.
  - Core: `ctrace` is the default up to 3.13. `sysmon` is the default on 3.14+, but on 3.12/3.13 "it does not support branch coverage", and it "does not yet support plugins, dynamic contexts". So on 3.14, `branch = true` plus the template's `dynamic_context` don't mix with sysmon.
  - **Per-module thresholds** aren't built in. Practical routes: run `coverage report --include='src/rolegraph/<context>/*' --fail-under=80` once per module, or post-process `coverage json`'s per-file data. Whether a test is *meaningful* (assertions, not just executed lines) is for [#14](https://github.com/tyey/rolegraph/issues/14) to decide.

## Options compared

### 1. Module layout per bounded context

Context names below are placeholders; the real ones come from the domain grilling ([#2](https://github.com/tyey/rolegraph/issues/2), [#9](https://github.com/tyey/rolegraph/issues/9), [#10](https://github.com/tyey/rolegraph/issues/10)).

| | A. Layer-first (Cosmic Python) | B. Context-first, layers inside | C. Package per feature (zhanymkanov) |
|---|---|---|---|
| Shape | `domain/`, `application/`, `infrastructure/`, `api/` at top. Contexts are modules inside each layer | `<context>/{domain,application,infrastructure,api}/` plus `shared_kernel/` and a composition root | `<context>/{router,schemas,models,service,dependencies,exceptions}.py` |
| DDD fit | Good layering, but a context is spread across 4 trees | Best. A context is a cohesive unit, and both boundaries are explicit | Weak. ORM models double as the domain, with no ports |
| Enforcement | import-linter `layers` | import-linter `layers` with `containers=[each context]` plus `independence` between contexts | Convention only |
| Cost | Low | Medium: more packages, some ceremony for tiny contexts | Lowest |
| Learning value | High | Highest: shows both strategic (contexts) and tactical (layers) DDD | Moderate |
| Used by | cosmicpython, clean-example (single context) | pgorecki/python-ddd (modules) | fastapi-best-practices |

### 2. Domain / application / infrastructure layering

The common rule in every source: dependencies point inward.

- **domain**: entities, value objects, aggregates, domain errors and domain services, written in plain Python (stdlib `dataclass`/classes, `enum`). It imports nothing from FastAPI, Pydantic or SQLAlchemy. Repository *ports* are defined as `Protocol`/ABC here or in the application layer.
- **application**: use cases (command/query handlers or service functions), the unit-of-work port, transaction boundaries. It depends only on the domain.
- **infrastructure**: SQLAlchemy `Table`s plus imperative mappings (or a separate ORM model with mapper functions), repository and unit-of-work implementations, file adapters for export/import, clock and ID providers.
- **api** (also called entrypoints or inbound): FastAPI routers, Pydantic request/response schemas, mapping domain errors to HTTP status codes, `Depends` wiring.
- **composition root** (`main.py` / `bootstrap.py` / `ioc/`): an app factory that builds the engine, providers and routers. Tests call it with test settings.

There are two ways to persist the domain:

- **(i) Imperative mapping onto the domain classes** (Cosmic, clean-example). There are no duplicate classes. The cost is that ORM instrumentation lives on domain objects at runtime, so the domain classes have to stay compatible with SQLAlchemy's mapping rules. Check the [mapping styles](https://docs.sqlalchemy.org/en/21/orm/mapping_styles.html) docs before reaching for `__slots__` or frozen entities.
- **(ii) Separate ORM models plus explicit mappers.** The domain is fully decoupled, at the price of boilerplate and double maintenance.

Either way, the import-linter contract stays green.

### 3. Dependency injection

| | A. FastAPI `Depends` only | B. Manual composition root + thin `Depends` | C. DI container (dishka) |
|---|---|---|---|
| How | `Annotated` aliases (`UowDep`, `RoleServiceDep`). Session/UoW from a `yield` dependency (`scope="function"` to commit before responding) | `bootstrap()` builds use-case objects from settings. `Depends` only fetches them from `app.state` / a request-scoped factory | `make_async_container(providers)` with `Scope.APP`/`Scope.REQUEST`, `FromDishka[T]`, `DishkaRoute` or `@inject`, `setup_dishka(container, app)`, close in lifespan ([dishka FastAPI](https://dishka.readthedocs.io/en/stable/integrations/fastapi.html)) |
| Tests | `app.dependency_overrides` (documented, simple) | Call `bootstrap(fake_uow)` directly for service tests; overrides for API tests | Swap providers / build a test container; FastAPI overrides don't reach dishka-provided objects |
| Coupling | Application code stays framework-free if `Depends` lives only in `api/` | Same, plus a single explicit wiring point | Wiring is declared in providers; handlers depend on dishka markers |
| Extra dep | none | none | dishka (1.3k★, active). Alternatives: dependency-injector (older, wiring-based), svcs (service locator), that-depends |
| Fit for rolegraph | Good for a small app | Good; the closest to the book | More power than a single-user app needs, but a real-world pattern worth learning |

### 4. Sync vs async with an embedded DB

| | A. Sync all the way | B. Async all the way | C. Async endpoints calling sync DB |
|---|---|---|---|
| Endpoints / deps | `def`, run in the threadpool | `async def` | `async def` + `run_in_threadpool` |
| DB stack | `Session`, pysqlite | `AsyncSession`, aiosqlite (`sqlalchemy[asyncio]`, greenlet) | `Session` |
| Real concurrency gain | None needed (one user). SQLite writes are serialised anyway | None for SQLite: aiosqlite is a thread per connection | None |
| Effect on DDD layers | Repos, UoW and use cases stay plain functions | `async` spreads into repository ports, UoW and every use case; the domain can stay sync | Leaks threading concerns into handlers |
| ORM pitfalls | Lazy loading works | No implicit IO: eager-load everything, `expire_on_commit=False`, `lazy="raise"` | n/a |
| Tests | Plain `def` tests with `TestClient` | anyio/pytest-asyncio, `AsyncClient` + `LifespanManager` | Mixed |
| Future (v3 agents, streaming) | Add `async def` endpoints only where needed (LLM calls, SSE). FastAPI mixes both freely | Already async | — |

### 5. Pydantic v2 API schemas vs domain models

| | A. Pydantic at the edges only | B. Pydantic as the domain model | C. SQLModel single model (FastAPI tutorial) |
|---|---|---|---|
| Domain | stdlib `dataclass` (frozen for value objects) with invariants in methods/`__post_init__` | `BaseModel` (frozen / `validate_assignment`) | Table class = domain = API base |
| API | `XCreate`/`XUpdate`/`XPublic` schemas in `api/`. Responses built with `from_attributes=True` + `model_validate(entity)`. PATCH uses `exclude_unset` (and the 0.151 null-vs-omitted change) | Domain models returned directly or subclassed | `HeroCreate`/`HeroPublic`/`HeroUpdate` from a base |
| Coupling | Domain is framework-free; mapping lives in one place | Domain depends on Pydantic (a stable library, but it is still a framework in the domain) | Domain, persistence and API are fused |
| Validation | Two kinds: input shape (Pydantic) and business invariants (domain) | One place, but mixes transport and business rules | Table models skip validation by default (SQLModel behaviour); CRUD-oriented |
| DDD fit | Best and most common in DDD sources | Acceptable in pragmatic codebases | Poor |

Settings belong in `pydantic-settings` at the composition root, optionally split per context (fastapi-best-practices).

### 6. Toolchain (uv + ruff + type checker)

| Concern | Options | Notes |
|---|---|---|
| Project/deps | uv with `[dependency-groups]`. Packaged app (`src/` layout, build backend) vs today's flat `app/` with `pythonpath = ["."]` | pytest docs push the `src` layout plus `importlib` mode. A packaged app also makes import-linter's `root_package` natural |
| Lint/format | ruff; rule set ranges from the template's set to the clean example's strict set | Add `FAST`, `PT`, `TID`, `B`, `UP`, `SIM`, `RUF` at least |
| Type gate | **mypy strict + pydantic plugin** / **pyright strict** / **ty** (beta) / **pyrefly** (stable) | The official template runs mypy strict **and** ty. mypy has the plugin and most docs; pyright is the VS Code/Pylance engine; ty is fast but 0.0.x with breaking changes |
| Architecture gate | import-linter | Turns the layer and context rules into a CI check; useful for an agent-driven factory |

### 7. pytest patterns

| Topic | Options |
|---|---|
| Layout | `tests/{unit,integration,e2e}` (Cosmic) vs `tests/<context>/{unit,integration,api}` mirroring option B above |
| Unit tests | Domain tests without fixtures. Use-case tests with in-memory fakes (`FakeRepository`, `FakeUnitOfWork`) |
| Integration | Real SQLite repositories. Either a **fresh DB per test** (`tmp_path` file or in-memory + `StaticPool`; simple and isolated; fast enough at this size) or a **session-scoped engine + per-test transaction rollback** (faster, but on SQLite it *requires* `autocommit=False` (Py 3.12+) for SAVEPOINTs to behave, plus the FK PRAGMA listener) |
| API tests | `with TestClient(create_app(test_settings)) as client` (runs lifespan) + `dependency_overrides` cleared in fixture teardown. If async: `AsyncClient` + `ASGITransport` + `LifespanManager` |
| HTTP client lib | Add **`httpx2`** to dev deps to silence the Starlette deprecation (keep `httpx` only if something else needs it) |
| Config | `[tool.pytest]` native TOML, `strict = true`, `--import-mode=importlib`, `filterwarnings = ["error"]` so deprecations like the httpx one fail CI |
| Coverage | `branch = true`, `source = [package]`. Per-module gate via `coverage report --include=... --fail-under=80` per context (or a small script over `coverage json`). Keep `ctrace` on 3.13; on 3.14, sysmon is default and `dynamic_context` is unsupported there |

## Recommendation (input for #11 and #14, not a decision)

1. **Layout:** option **B**: context-first packages, each with `domain/application/infrastructure/api`, plus a small `shared_kernel` and an app-factory composition root. Use a `src/` package (`uv init --package` style). Enforce it with import-linter: a `layers` contract over `containers` = every context, and an `independence` contract between contexts. This gives the factory's agents a mechanical boundary check.
2. **Persistence mapping:** SQLAlchemy 2.1 Core `Table`s with **imperative mapping** onto plain dataclass entities, plus a repository and a unit of work per aggregate. Keep the FK `PRAGMA` listener and `autocommit=False` in the engine factory from day one. Use Alembic for migrations. Avoid SQLModel for the domain.
3. **Sync:** go **sync all the way** for the DB path: `def` endpoints, `Session`, pysqlite. Async buys nothing for a single-user embedded DB, and it would spread `async` through every port and use case. Add `async def` only at the edges that need it (v3 LLM calls, streaming).
4. **Pydantic:** **edges only**. API schemas per use case in `api/`, built from domain objects with `from_attributes=True`. `pydantic-settings` for config. Domain uses stdlib dataclasses.
5. **DI:** start with **FastAPI `Depends` plus a manual composition root** (option B). `Annotated` aliases live in each context's `api/` package; the unit of work comes from a `yield` dependency with `scope="function"`; tests use `dependency_overrides` and direct `bootstrap()` calls with fakes. Revisit dishka only if the wiring gets painful.
6. **Toolchain:** uv dependency groups; ruff for lint and format (template rules plus `FAST`, `PT`, `TID`, `SIM`, `RUF`); **mypy `strict` + `pydantic.mypy`** as the gate (the official template's choice), with ty or pyright optional in the editor; import-linter in the same gate.
7. **Tests:** pytest 9 with `[tool.pytest]`, `strict = true`, `importlib` mode, `filterwarnings = error`. Replace `httpx` with `httpx2`. Use `tests/<context>/{unit,integration,api}`, fakes for use cases, and a fresh SQLite DB per integration/API test. Run branch coverage with a per-context `--fail-under=80` loop. Whether coverage is meaningful (assertion quality, possibly mutation testing) is for #14.

Open questions for the grilling tickets:

- What are the bounded contexts and aggregates? (#2, #9, #10)
- Is the DB SQLite? (#4)
- Python 3.13 or 3.14? (affects the coverage core and the template's baseline)
- Should export/import be its own context or an infrastructure adapter? (#15)
- How strict should the ruff rule set be?
