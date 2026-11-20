# A hand-written, read-only MCP server in the app

rolegraph exposes an **MCP server at `/mcp`**, mounted in the same FastAPI container over Streamable HTTP. A Claude session connects with `claude mcp add --transport http rolegraph http://<server>/mcp`. The server is **read-only**, so an agent can rebuild its context, for example after an interrupted onboarding, without being able to damage data. All writes go through the REST API (ADR 0012), which is the only place that holds idempotency, matches and error rules.

It offers **six hand-written, workflow-level tools**. Each returns compact JSON with ids and names, so the agent can write with those ids next.

- `find`: Persons, Companies and Agencies by name, alias or Profile link, with exact matches flagged.
- `list_processes`: filtered by Company, Agency, Role, or Open/Closed.
- `get_process`: one Process with its whole Timeline, Participants with their Persons' names, and Documents with their sha256 and file names.
- `get_role_graph`
- `list_catalog`: Step kinds, Channels, Parts and Document kinds.
- `search`: full-text search.

It is built with the official `mcp` Python SDK (2.x). The tools call the modules' application-layer queries directly, with no HTTP round trip. It lives in a new top module, **`mcp`**, beside `search` and `exchange`. That module has only an `api` layer, may call every module, and is kept at the top by import-linter.

Because the server sits on a LAN address, the SDK's host and Origin checks get an allowlist taken from configuration (the MCP spec requires `Origin` validation). The `rolegraph_demo=1` cookie picks Demo data exactly as it does for REST (ADR 0011).

## Considered Options

- **Generating tools from FastAPI** (`FastMCP.from_fastapi`, `fastapi-mcp`). Rejected: either way gives one tool per endpoint. FastMCP's own docs recommend that only for prototyping, and Anthropic's tool-writing guidance advises against it. `fastapi-mcp` is also stale and broken with mcp 2.x.
- **A stdio server on the agent's machine calling REST.** Rejected: it would be a second deliverable to install and keep in step with the API.
- **Write tools in MCP as well.** Rejected: every write rule would need a second, MCP-shaped error form, and twice the tests. A read-only server is safe by construction.
- **MCP resources instead of tools.** Rejected: lookups need filters, and Claude Code surfaces tools more directly.

## Consequences

- ADR 0002's module order gains `mcp` at the top: `mcp | exchange | search > processes > …`.
- `mcp` is the one backend module with no frontend feature folder, an exception to ADR 0005, because no UI uses it.
- The startup lifespan must also run the MCP session manager, because a mounted app's own lifespan never runs.
