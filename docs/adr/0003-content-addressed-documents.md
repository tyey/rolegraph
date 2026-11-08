# Documents are content-addressed files keyed by sha256

A Document is identified by its bytes, so its key is its **sha256**: no surrogate UUID. The bytes are stored once, as an immutable file at `<data dir>/documents/sha256/<first 2 hex>/<digest>`. SQLite holds the Document's metadata (size, media type, Document kind, Sent/Received, Provenance). The file name a Document was added under is kept on each Step's attachment, so the same bytes can carry different names on different Steps.

Uploading writes the file first. That is idempotent, because the name is the hash. The row is then committed in the unit of work. A failed commit leaves only an orphaned file, which is harmless, and a GC removes files that have no row. Code reaches the bytes only through a `DocumentStore` port (`put` / `open` / `exists`), with a filesystem adapter and an in-memory fake.

## Considered Options

- **BLOBs in SQLite.** One file, atomic with the metadata, and a snapshot is a single `VACUUM INTO`. Rejected: CVs and PDFs of hundreds of KB to a few MB would grow the database steadily, space comes back only with `VACUUM`, and SQLite's own benchmarks favour external files above ~100 KB.
- **A UUID key with a unique hash column.** Rejected: it turns the glossary's "identified by its bytes" into a constraint instead of the identity.

## Consequences

- A snapshot is the database **plus** the `documents/` directory. Because the files never change, copying them after a backup-API snapshot of the database is consistent. The format is decided in "Local runtime, data directory & export/import".
