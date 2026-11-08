# One bounded context, split into ordered modules

The backend is **one bounded context**, because `CONTEXT.md` is one shared language. It is split into modules named after glossary terms: `shared`, `catalog`, `roles`, `companies`, `agencies`, `people`, `documents`, `processes`, plus the top modules `search` and `exchange`. Each module has `domain → application → infrastructure → api` layers. Modules depend on each other in one direction only:

`exchange | search > processes > roles | companies | agencies | people | documents | catalog > shared`

import-linter enforces both orders: layers inside every module, and modules against each other.

Some operations reach upward. Deleting a Role, Company, Agency or Person is refused while a Process references it, and a Merge must re-point every Process that refers to the folded one. For these, a lower module declares a small **port** in its application layer (for example `RoleReferences.is_referenced` / `repoint`). `processes` implements the port, and the composition root wires it in. The whole operation runs in one unit of work, so one SQLite transaction. Foreign keys with `ON DELETE RESTRICT` act as a backstop. For a Person Merge, the adapter loads the affected Processes and lets the Process aggregate combine their Participants. It does not rewrite rows behind the aggregate's back.

Each module also declares its own unit-of-work Protocol, listing only the repositories it needs. One concrete SQLAlchemy unit of work satisfies all of them, so `shared` never imports a module.

## Considered Options

- **Several bounded contexts with an independence contract**, as the FastAPI DDD research suggested. Rejected: there is one language, and Merge, Reclassify and the delete refusals cut across any split, so the contexts would be artificial and need anti-corruption layers.
- **Layer-first packages** (`domain/`, `application/`, … at the top). Rejected: each feature would be spread over four trees, which is worse for one-module-per-ticket agent work.
- **Domain events on an in-process bus** for the cross-module operations. Rejected for now: the delete refusal needs a synchronous veto, and a bus adds machinery with no second consumer.
