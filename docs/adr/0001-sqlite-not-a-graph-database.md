# SQLite is the system of record, not a graph database

rolegraph's data reads like a network: Roles in a DAG, and Persons, Processes, Companies, Agencies and Documents linked to each other. Even so, the one store is embedded SQLite. The Role graph is a `role_edge` adjacency table read with `WITH RECURSIVE`. The network questions people actually ask are fixed-length joins in query services, such as "which Persons link these two Companies?" or "every Process this recruiter was in". For visual exploration, a one-way **graph export** writes the dataset as nodes and edges that a graph tool can load. It is part of v1 and ships after snapshot export/import.

## Considered Options

- **Neo4j as the store.** Neo4j has no embedded mode for Python, so the app would need a JVM server running (Docker or Desktop). The Community edition's dump needs the database stopped, which fights atomic export snapshots to a synced folder. There is also no SQLAlchemy/Alembic-grade tooling.
- **Ladybug (the Kùzu fork) as the store.** It is in-process and speaks Cypher, but it is a young fork of an archived project, with no ORM or migration story.
- **SQLite plus a live Neo4j projection.** It gives live graph browsing, at the cost of two stores to keep in step and Docker as a dependency.

## Consequences

- Moving to a graph store later means rewriting every repository and query service, which is why this is recorded.
- The graph export's format (Cypher script, GraphML or CSV pairs) is decided with the snapshot format in "Local runtime, data directory & export/import".
