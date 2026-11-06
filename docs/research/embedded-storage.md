# Research: embedded storage for a role DAG, timelines and documents

Ticket: [#4](https://github.com/tyey/rolegraph/issues/4) · Map: [#1](https://github.com/tyey/rolegraph/issues/1) · Researched 2026-11-06

This note collects facts. It does not make the decision. The storage choice is settled later in a grilling ticket, which can use this note as input.

## Question

What embedded, lightweight storage should rolegraph use in 2026? The app is single-user and runs on localhost. Its data has three shapes:

- **Roles** form a multi-parent DAG. A Role can have several parents, there are no cycles, and there can be several roots.
- Each **Process** hangs off one Role and has a timeline of Steps.
- Steps have attached **documents**, such as CVs, PDFs and notes.

The question has four parts:

1. Which engine fits: SQLite (recursive CTEs, JSON, FTS5), DuckDB, or an embedded graph database? Which embedded graph databases are still maintained?
2. Should document blobs live in the database or as files in a data directory?
3. How safe is it to keep a live database file in a Dropbox or Nextcloud folder, compared with export/import snapshots?
4. Which Python libraries are the mainstream choice?

## Key facts

### SQLite

- **Current release:** 3.54.1, released 2026-10-16 ([release log](https://www.sqlite.org/releaselog/current.html)).
- **What Python bundles:** The Python that `uv` installs for this repo (3.13.18, the version in `backend/.python-version`) comes with SQLite 3.53.1, compiled with `ENABLE_FTS5`. JSONB, FTS5 and recursive CTEs all worked there; this was checked on 2026-11-06 with `pragma compile_options` and a test query.
- **DAG traversal:** SQLite's `WITH RECURSIVE` handles graph traversal directly. The docs walk through a directed graph, a version-control commit DAG. They use `UNION` instead of `UNION ALL` so that duplicate rows are dropped and recursion cannot loop forever on a cycle ([lang_with](https://www.sqlite.org/lang_with.html)). An ancestors-of-a-Role query over a `role_edge(parent_id, child_id)` table was tested locally and returned every ancestor through both parent paths.
- **Cycles are the app's job:** SQL does not enforce "no cycles". The app has to check for a cycle before inserting a Role edge. One recursive query can do it: is the new parent a descendant of the child?
- **JSON:** JSON functions are built in. SQLite 3.45.0 and later also has **JSONB**, a binary JSON encoding stored as a BLOB ([jsonb](https://www.sqlite.org/jsonb.html)). SQLAlchemy has both `JSON` and `JSONB` types for SQLite; `JSONB` needs SQLite 3.45 or later ([SQLAlchemy SQLite dialect](https://docs.sqlalchemy.org/en/21/dialects/sqlite.html)).
- **Full-text search:** FTS5 is a virtual-table module for full-text search ([fts5](https://www.sqlite.org/fts5.html)). SQLAlchemy has no ORM type for it, so it needs raw DDL in an Alembic migration plus triggers or app code to keep the index in step.
- **Foreign keys:** Enforcement is off by default and must be turned on per connection with `PRAGMA foreign_keys=ON`. SQLAlchemy documents a `connect` event listener for this ([dialect docs](https://docs.sqlalchemy.org/en/21/dialects/sqlite.html)).
- **Transactions in `sqlite3`:** The driver's default "legacy" transaction mode does not emit `BEGIN` for SELECTs. Python 3.12+ offers `autocommit=False`, which SQLAlchemy accepts via `connect_args`. The legacy default is to be removed in Python 3.16 ([dialect docs](https://docs.sqlalchemy.org/en/21/dialects/sqlite.html)).

### DuckDB

- **Current release:** v2.0.0, released 2026-10-21 ([GitHub release](https://github.com/duckdb/duckdb/releases); PyPI `duckdb` 2.0.0).
- **Built for analytics:** DuckDB says it is "designed to support analytical query workloads" (OLAP), with bulk writes rather than row-by-row changes ([why DuckDB](https://duckdb.org/why_duckdb)).
- **Concurrency:** One process can read and write. Several processes can open the file only in `READ_ONLY` mode. Writing from several processes needs the Quack remote protocol or DuckLake ([concurrency](https://duckdb.org/docs/2.0/connect/concurrency.html)).
- **Recursive queries:** DuckDB supports `WITH RECURSIVE` and `USING KEY`. Cycle detection is manual ([WITH clause](https://duckdb.org/docs/2.0/sql/query_syntax/with.html)).
- **Graph extension:** [DuckPGQ](https://github.com/cwida/duckpgq-extension) adds SQL/PGQ graph queries as a community extension. Its README calls it "a research project and a work in progress". The repo was last pushed 2026-11-04.
- **Python stack:** DuckDB is not a first-class SQLAlchemy/Alembic backend. Support comes from the third-party `duckdb_engine` dialect.

### Embedded graph databases: maintenance status (checked via GitHub API, 2026-11-06)

| Project | Status | Evidence |
|---|---|---|
| **Kùzu** | **Archived.** Do not adopt. | `kuzudb/kuzu` is archived. The last release was v0.11.3 on 2025-10-10. The README says "We are archiving the KuzuDB project". PyPI `kuzu` has not moved past 0.11.3. |
| **Ladybug** (Kùzu fork) | Active | [LadybugDB/ladybug](https://github.com/LadybugDB/ladybug): ~1.9k stars, pushed 2026-11-06, latest release v0.22.1 on 2026-10-28. PyPI package `ladybug` 0.22.1. The README says it was "formerly known as Kuzu". It uses Cypher, is MIT-licensed, and is built for "complex analytical workloads on very large databases". |
| **RyuGraph** (Kùzu fork) | Low activity | [predictable-labs/ryugraph](https://github.com/predictable-labs/ryugraph): last push 2026-01-20. PyPI `ryugraph` 25.9.2, released 2025-12-06. |
| **CozoDB** | Stalled | [cozodb/cozo](https://github.com/cozodb/cozo): last release v0.7.6 in 2023-12, last push 2024-12. |
| **FalkorDBLite** | Active, but not truly in-process | PyPI `falkordblite` 0.11.0 (2026-10-19). Its README says it provides "a built-in Redis server with FalkorDB module", so it starts and manages a server process. |

Two things these graph databases do not give rolegraph:

- **Size:** A DAG of a few dozen to a few hundred Roles is small. A recursive CTE handles it easily, so a graph engine's speed and Cypher bring nothing that matters.
- **Python tooling:** None of them has a SQLAlchemy/Alembic-grade story for schema migration or ORM mapping.

### Document blobs: in the database vs files

- **SQLite's own benchmark:** BLOBs under ~100 KB read faster from inside the database. BLOBs over ~100 KB read faster as separate files. Page sizes of 8192 or 16384 work best for large BLOBs ([intern-v-extern-blob](https://www.sqlite.org/intern-v-extern-blob.html)). A later measurement found SQLite about 35% faster than the filesystem for ~10 KB blobs ([fasterthanfs](https://www.sqlite.org/fasterthanfs.html)).
- **What rolegraph stores:** Mostly PDFs and CVs (often more than 100 KB) and short notes. At single-user scale the speed difference is too small to notice either way. The choice is really about:
  - **Blobs in the database:** One file holds everything, so a snapshot is that one file. Writes are atomic with the metadata. The database grows over time, and space is reclaimed only by `VACUUM`.
  - **Files in a data directory:** A row stores the path and hash. Files can be opened in a normal viewer. The database stays small. The app must keep files and rows consistent: orphaned files, and files missing for a row. A snapshot then means database plus directory, for example a zip.
  - **Common middle ground:** Store files content-addressed (named by SHA-256) in a `documents/` directory, with metadata (filename, MIME type, size, hash, Step id) in SQLite. Short text notes can live in a TEXT column, where FTS5 can index them.

### Live database file in a Dropbox/Nextcloud folder vs export snapshots

**What SQLite says:**

- **Copying mid-transaction:** A copy made during a write transaction can hold "some old and some new content, and thus be corrupt". A plain file copy is safe only when no transaction is in progress ([howtocorrupt §1.2](https://www.sqlite.org/howtocorrupt.html)).
- **Journals must travel with the file:** A database file copied without its hot `-journal` or `-wal` file can corrupt. So can a journal mispaired with the wrong database ([howtocorrupt §1.3–1.4](https://www.sqlite.org/howtocorrupt.html)). A sync client uploads these files on its own schedule, one by one.
- **Locks don't cross machines:** SQLite needs working file locks ([howtocorrupt §2](https://www.sqlite.org/howtocorrupt.html)). In WAL mode, every process must be on the same host, because WAL uses shared memory through the `-shm` file ([wal](https://www.sqlite.org/wal.html)). A sync service carries no locks between machines. Its other end is a different host.
- **Over a network:** SQLite says remote use "is done at the user's risk". It recommends keeping the engine on the same machine as the file ([useovernet](https://www.sqlite.org/useovernet.html)).

**What the sync tools do:**

- **Dropbox:** Concurrent edits produce a "conflicted copy", and "the last version saved will always appear as the conflicted copy" ([Dropbox help](https://help.dropbox.com/syncing-uploads/conflicted-copy)). For a binary database file there is nothing to merge: one side's changes are set aside.
- **Nextcloud:** The desktop client keeps the server version under the original name and saves the local one as a "conflicted copy". By default it does not upload that copy ([Nextcloud desktop conflicts](https://docs.nextcloud.com/server/stable/user_manual/en/desktop/conflicts.html)).

**What other apps do:**

- **Zotero:** Zotero's knowledge base says keeping its SQLite data directory in a cloud-storage folder is "extremely likely to corrupt your database", because sync services don't honor its file locks ([Zotero KB](https://www.zotero.org/support/kb/data_directory_in_cloud_storage_folder)).
- **Quilltap:** In one secondary data point, Quilltap 4.3.1 switched its default from WAL to `TRUNCATE` journal mode. Its reason was that `-wal`/`-shm` files synced out of order and corrupted databases ([release notes](https://github.com/foundry-9/quilltap-server/releases/tag/4.3.1)).

**Safe snapshot mechanisms (all work on a live database):**

- [`VACUUM INTO 'file'`](https://www.sqlite.org/lang_vacuum.html): writes the current state into a new, compact file.
- The [online backup API](https://www.sqlite.org/backup.html), exposed in Python as `sqlite3.Connection.backup()`.
- `sqlite3_rsync`, for copies over SSH.

`VACUUM INTO` and `Connection.backup` were both tested locally. The usual pattern is to write the snapshot to a temporary name and then rename it into the sync folder. The sync client then only ever sees a complete file.

**Net:** A live database in a synced folder is a known corruption and lost-update risk. Export snapshots written atomically, with the live database kept in a local data directory, fit SQLite's documented guarantees.

### Python libraries (versions from PyPI / GitHub, 2026-11-06)

- **SQLAlchemy 2.1.8** (released 2026-11-04; 2.1.0 tagged 2026-09-24): the standard Python ORM and SQL toolkit.
  - Its SQLite dialect is first-class. It covers JSON/JSONB, `aiosqlite` async, and foreign-key pragma recipes.
  - For DDD it supports **imperative mapping** (`registry.map_imperatively()`), which maps plain domain classes to tables without SQLAlchemy base classes. Its docs say the result is the same configuration as declarative mapping ([mapping styles](https://docs.sqlalchemy.org/en/21/orm/mapping_styles.html)).
  - This lets domain entities stay persistence-ignorant, with mapping kept in the infrastructure layer.
- **SQLModel 0.0.48** (released 2026-10-06): the [FastAPI tutorial](https://fastapi.tiangolo.com/tutorial/sql-databases/) uses and recommends it, built on SQLAlchemy and Pydantic.
  - It is still classified "Development Status :: 4 - Beta" and pins `SQLAlchemy >=2.0.14,<2.2.0`, so 2.1 is supported. The repo is active (pushed 2026-11-02).
  - One class serves as table model and Pydantic schema at once. That is convenient, but it ties the domain model to persistence and to the API, which works against a strict DDD layering.
- **Alembic 1.20.1** (released 2026-10-22): the migration tool for SQLAlchemy and SQLModel. SQLite "has almost no support for the ALTER statement", so Alembic uses **batch mode** ("move and copy": create the new table, copy the rows, drop the old table, rename). Setting `render_as_batch=True` in `env.py` makes autogenerate emit batch operations ([batch docs](https://alembic.sqlalchemy.org/en/latest/batch.html)).
- **aiosqlite 0.22.1**: the async SQLite driver used by SQLAlchemy's `sqlite+aiosqlite`. It is optional. FastAPI works fine with sync SQLAlchemy sessions in threadpool endpoints.
- **Others:** `sqlite-utils` 4.2.1 is handy for scripts and exports, but it is not an ORM.

## Options compared

| Option | DAG (multi-parent) | Timelines / documents | FTS | Python ecosystem | Sync-folder story | Fit |
|---|---|---|---|---|---|---|
| **SQLite + recursive CTEs, JSON/JSONB, FTS5** | Adjacency table plus `WITH RECURSIVE`; cycle check in the app | Normal tables; blobs inline or as files | FTS5 built in (raw DDL) | stdlib driver; SQLAlchemy, SQLModel and Alembic all first-class | `VACUUM INTO` / backup API give atomic snapshots | **Strong** |
| **DuckDB** | `WITH RECURSIVE` / `USING KEY`; DuckPGQ (research) | Fine, but built for OLAP, not many small transactional writes | FTS extension | Third-party SQLAlchemy dialect; weak Alembic story | Single file plus WAL; `EXPORT DATABASE` | Weak: wrong workload |
| **Ladybug (Kùzu fork)** | Native Cypher graph | Properties on nodes; no blob story | Built in | Own Python API; no ORM or migrations | No documented sync or backup guidance found | Overkill; a young fork of an archived project |
| **Kùzu** | Native | — | — | — | — | **Ruled out (archived 2025-10-10)** |
| **CozoDB / RyuGraph** | Datalog / Cypher | — | — | Thin | — | Ruled out (stalled or low activity) |
| **FalkorDBLite** | Cypher | — | — | Redis-py based | Runs a Redis server process | Not truly embedded |
| **Blobs in the DB** | — | One-file snapshot; atomic with metadata | Text only | `LargeBinary` | Snapshot = 1 file | Simple; the DB grows |
| **Blobs as files plus metadata rows** | — | Opens in normal viewers; small DB | Text only | Plain filesystem code | Snapshot = DB + dir (zip) | Flexible; consistency is the app's job |

## Recommendation (input for the grilling ticket, not a decision)

1. **Engine: SQLite**, using the `sqlite3` module bundled with Python (3.53.x, which has FTS5 and JSONB).
   - Model Roles as a `role` table plus a `role_edge(parent_id, child_id)` adjacency table with a composite primary key.
   - Traverse with `WITH RECURSIVE … UNION`.
   - Enforce "no cycles" in the domain layer by running a reachability query before inserting an edge.
   - Turn on `PRAGMA foreign_keys=ON` on every connection.
2. **Libraries: SQLAlchemy 2.1 + Alembic** (with `render_as_batch=True`). Two choices remain for the grilling ticket:
   - **Imperative mapping:** keeps domain entities free of the ORM, which suits the DDD goal.
   - **SQLModel:** less code, at the cost of mixing domain, table and API schema.

   Async (`aiosqlite`) is optional and probably unneeded for a single user.
3. **Documents: files in a local `data/documents/` directory, content-addressed by SHA-256, with metadata rows in SQLite.** Short text (prep notes, feedback) goes in TEXT columns indexed by FTS5. Storing blobs in the database is a valid simpler alternative if a single-file snapshot matters more.
4. **Sync: never keep the live DB in Dropbox or Nextcloud.**
   - Keep the live data directory local, for example under the OS app-data directory.
   - **Export** a snapshot to the synced folder: `VACUUM INTO` a temp file, plus the documents, zipped, then an atomic rename.
   - **Import** by replacing local data from a chosen snapshot.
   - Optionally, also offer a JSON export for diffs and agent-friendliness.

## Open questions for grilling

- Imperative SQLAlchemy mapping or SQLModel? Which matters more: strict DDD or less boilerplate?
- Blobs in the database or files? How much does a single-file snapshot matter compared with documents a user can browse?
- Snapshot format: raw SQLite file, zip of DB plus documents, or a versioned JSON/NDJSON export? Should import refuse a snapshot from a newer schema version?
- Is a "last export" marker or lock file needed to warn when two machines diverge?
- Sync or async SQLAlchemy sessions under FastAPI?
