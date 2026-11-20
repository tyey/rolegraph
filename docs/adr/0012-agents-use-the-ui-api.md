# Agents write through the UI's REST API, with whole-Process creates and client IDs

An outside agent (another Claude session) builds the candidate's history through **the same REST API the UI uses**. There is no separate agent surface. The API adds one agent-friendly write: `POST /api/processes` takes a whole Process with its Timeline (Steps, Participants, Reflections, Feedback, Prep notes) in one aggregate write. That body refers to the Role, Company, Agency, Persons and Documents **only by id**. The agent creates or finds those first through their own endpoints.

**Idempotency comes from client IDs.** Every create carries its UUIDv7 `id` in the body. A Document's key is its sha256 instead.

- An unknown id returns **201**.
- A known id with the same content returns **200** with the stored resource, so a retry after a lost response succeeds without doing anything.
- A known id with different content returns **409** `id-in-use`, naming the resource and its version. A create never overwrites what the candidate edited.

There is **no external-reference field**. An agent that lost its IDs, such as one in a new session, rebuilds its context by reading what is already there through the read-only MCP server (ADR 0014).

**Matches are offered by refusing the create.** In these cases the create returns **409** `match-found` with the candidates:

- a new Person whose Profile link already belongs to another Person
- a new Company whose name or alias already belongs to another Company
- a new Agency whose name already belongs to another Agency

The agent shows the candidates to the candidate. It then uses an existing id, or re-sends the create with `not_the_same_as: [ids]`. That records the lasting "not the same" mark, so the pair is never offered again. A similar name is only a suggestion and never blocks. The UI's own creates follow the same rule.

**Stale writes.** Reads return each aggregate root's `version`, and every update or delete body carries it. A stale write returns **409** `stale-version`. There are no ETag or If-Match headers.

**No API version.** Paths stay `/api/<module>/…`. The UI ships in the same image, and agents read `/api/openapi.json` again each session. Breaking changes are called out in the release notes.

**OpenAPI quality is a test.** A pytest over the generated document fails when any of these is missing, and it runs in `./check`:

- a summary and description on an operation, written in glossary terms
- a description on each request-schema field
- an example on each write
- the problem+json 404, 409 or 422 responses an operation can return

**Demo trials.** An agent points at Demo data by sending `Cookie: rolegraph_demo=1`: with curl, or with `claude mcp add --header` for the MCP server (ADR 0011).

## Considered Options

- **A separate `/api/agent` surface.** Rejected: it would be a second contract to version and test, and a second front door to every use case.
- **A nested create that also makes new Persons, Companies and Agencies inline**, or a **generic command batch**. Rejected: the Process endpoint would write other aggregates and run Person matching inside itself, or a dispatcher and a large union schema would be needed. An agent re-sending a failed Process write is already safe, because every create is idempotent.
- **PUT upsert by id.** Rejected: a re-run could replace a Timeline the candidate has edited since.
- **The `Idempotency-Key` header.** Rejected: it needs a response store, it duplicates what client IDs already do, and the IETF draft is still not an RFC.
- **An `external_ref` on Processes and Steps.** Rejected by the user in favour of reading existing data through MCP.
- **Always creating, with matches offered later in the UI.** Rejected: one agent run could quietly add many duplicates.

## Consequences

- Each create use case needs an equality check for the "same content" case.
- The glossary rule for matches and the "not the same" mark now covers Companies and Agencies as well as Persons.
