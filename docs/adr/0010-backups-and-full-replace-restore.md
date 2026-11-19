# Backups are SQLite-plus-documents zips; Restore replaces everything

A **Backup** is one zip written to `ROLEGRAPH_BACKUP_DIR` (`/backups` in the container). It holds:

- `rolegraph.sqlite3`, made with `VACUUM INTO`. It carries the catalog lists and the FTS index too.
- `documents/sha256/…`, copied after the database. The files are immutable (ADR 0003), so the pair is consistent.
- `json/`, a **read-only**, domain-shaped mirror: one file per module, built from the query services, using glossary names and the same IDs.
- `manifest.json`, written last. It holds `format`, the Alembic revision, the app version, the creation time, row counts and each file's sha256.

The zip is written under a temp name and then renamed, so a watcher never sees half a file. The file name is `rolegraph-<utc>-<reason>.zip`, where the reason is `daily`, `manual`, `pre-migration-<rev>` or `pre-restore`.

**When.**

- **Automatic**: one Backup for each day on which anything was added or changed. The unit of work stamps the last committed write in a one-row table. At `ROLEGRAPH_BACKUP_AT` (03:00 by default), a lifespan thread backs up if that stamp is newer than the last automatic Backup. It runs the same check at startup, in case the server was off at 03:00. Only the **14 most recent** automatic Backups are kept, and older ones are pruned after each run, matching rolegraph's own file-name pattern only.
- **Manual**: "Back up now".
- **Pre-migration**: at startup, before `alembic upgrade head`.
- **Pre-restore**: step 3 of a Restore.

Manual, pre-migration and pre-restore Backups are never pruned.

**Where.** On the server, `/backups` is bind-mounted to a folder on the RAID. Nextcloud shows that folder as Local External Storage, and a laptop's Nextcloud client syncs it down as the off-server copy. rolegraph holds no Nextcloud credentials. Only finished, never-edited zips ever reach a synced folder, never the live database (research: embedded-storage).

**Guard.** The app warns when:

- the backup dir isn't writable
- the backup dir is on the same filesystem as the data dir (checked only when `ROLEGRAPH_REQUIRE_SEPARATE_BACKUP_DISK` is set, as the image sets it)
- a change is more than 48 h old with no Backup after it

The warning is a red banner on every page, and `/api/health` reports `degraded`. The app keeps running.

**Restore is a full replace.** It never merges. It works from the list of Backups or from an uploaded zip, and in this order:

1. Check the manifest and every sha256.
2. Refuse a Backup from a newer schema.
3. Take a pre-restore Backup.
4. Unpack into a staging dir and run `alembic upgrade head` on it.
5. Swap the staging dir in and reopen the engine.

A failure before step 5 leaves the live data untouched. The JSON mirror is never read back.

**Graph export** (ADR 0001) is **GraphML**, generated on demand at `GET /api/exchange/graph.graphml` and not put inside Backups. Gephi opens it natively, and Neo4j loads it with APOC's `apoc.import.graphml` (`readLabels`). Edge labels follow glossary relations.

All of this lives in the top `exchange` module (ADR 0002).

## Considered Options

- **A versioned JSON export as the restore format.** Rejected: every schema change would need a matching exporter, importer and format upgrader. The SQLite file reuses the normal migration path. JSON is kept for reading only.
- **Merge on import.** Rejected: one live instance (ADR 0009) leaves nothing to merge. UUIDv7 IDs keep merging possible if that ever changes.
- **Nightly Backups whether or not anything changed, and tiered weekly and monthly retention.** Rejected: unchanged days add nothing, and 14 change-days plus the kept special Backups are enough history.
- **Host cron calling a CLI, or WebDAV upload to Nextcloud.** Rejected: a lost cron entry stops backups silently, and WebDAV would need a stored credential and retry logic.
- **CSV node/edge pairs or a Cypher script for the graph export.** Rejected: CSV needs a header convention for each tool, and Cypher is Neo4j-only.

## Consequences

- An upgrade that goes wrong is undone by Restoring its pre-migration Backup on the previous image. This is the rollback that ADR 0007's forward-only migrations rely on.
- The `json/` mirror is versioned by `format` only. Changing its shape is free, since nothing parses it.
