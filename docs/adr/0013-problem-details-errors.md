# Errors are RFC 9457 problem details with stable codes, written by hand

Every error response is `application/problem+json` with these members:

- `status`, `title` and `detail`
- a stable kebab-case **`code`** that clients switch on, such as `not-found`, `validation-failed`, `stale-version`, `id-in-use`, `match-found` or `referenced`
- `type`, left as `about:blank`

Some codes carry extension members:

- **422** adds `errors: [{pointer, code, detail}]`, where `pointer` is a JSON Pointer into the request body, such as `#/steps/2/day`. FastAPI's own request-validation errors, normally `{"detail": [...]}` with Pydantic `loc` arrays, are rewritten into this shape, so a missing field and a domain rule broken on a field look the same to a client.
- **409** adds `resource: {kind, id, version}` for `stale-version` and `id-in-use`, or `matches: [{kind, id, name, reason}]` for `match-found`.

Domain and application errors map to problems in one place, `shared/api/errors.py`. Each operation declares the problems it can return in OpenAPI, so Orval types them. The frontend's error mapper (ADR 0005) sorts them by `code` into FieldErrors, Conflict, NotFound and Unexpected.

## Considered Options

- **`fastapi-problem` or `fastapi-problem-details`.** Rejected: both are small, young libraries. One of them reports Pydantic `loc` rather than JSON Pointers, and the 409 extensions would need custom code anyway. A hand-written handler is about 50 lines.
- **FastAPI's default `{"detail": ...}` plus a code.** Rejected: it is not a standard, and agents find `loc` arrays harder to map to fields than pointers.
- **Absolute `type` URIs as the code.** Rejected: no domain belongs to rolegraph, and a short `code` is easier to switch on.
