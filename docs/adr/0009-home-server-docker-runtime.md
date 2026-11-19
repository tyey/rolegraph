# One Docker image on a home server is the only live instance

rolegraph runs as **one container on a home server**. That server holds the only live data, and every laptop or phone uses it through the browser. The server is reachable on the **LAN only**, and v1 has no auth: anyone on the LAN is the candidate. Because there is one live instance, nothing has to sync between machines. Moving data between places is limited to Backup and Restore (ADR 0010).

**Image.** A multi-stage `Dockerfile` at the repo root. A Node stage builds `frontend/dist`. A `python:3.14-slim` + uv stage installs the backend and copies the build in. The `rolegraph` console script runs uvicorn on `0.0.0.0:8000`. FastAPI serves `/api/*` from the routers and every other path from the built SPA, falling back to `index.html`. The API therefore stays on the same origin, as the frontend's relative `/api` URLs require ([Frontend architecture & conventions](https://github.com/tyey/rolegraph/issues/12)), and the image needs no CORS and no nginx.

**Startup.** The app takes a pre-migration Backup, runs `alembic upgrade head`, then serves.

**Configuration.** pydantic-settings reads `ROLEGRAPH_*` env vars. The image sets these:

- `ROLEGRAPH_DATA_DIR=/data`: a named volume holding `rolegraph.sqlite3`, `documents/` and `demo/` (ADR 0011)
- `ROLEGRAPH_BACKUP_DIR=/backups`: a bind mount, see ADR 0010
- `ROLEGRAPH_REQUIRE_SEPARATE_BACKUP_DISK=true`

The time zone for the nightly Backup comes from `TZ`.

**Releases.** CI pushes to GHCR on every merge to `main` (`:main`, `:sha-<short>`). It also pushes on every `vX.Y.Z` git tag (`:vX.Y.Z`, `:latest`). The server never upgrades by itself. The candidate runs `docker compose pull && docker compose up -d` when they choose. Factory merges therefore never reach real data until a release is cut.

**Root `compose.yaml`.** It has both `image: ghcr.io/tyey/rolegraph:${ROLEGRAPH_TAG:-latest}` and `build: .`, so one file serves three uses:

- pulling a release
- smoke-testing the current checkout with `docker compose up --build`
- shipping an unpublished local build: `docker --context <server> compose up -d --build` sends the checkout to the server's Docker daemon over SSH, so it builds natively on x86_64 and never touches GHCR

The port binds to `${ROLEGRAPH_BIND:-127.0.0.1}`. The server sets it to its LAN address.

**Development** stays native, with no Docker. A root `./dev` script, alongside `./check`, runs `uv run uvicorn --reload` and Vite together. Vite proxies `/api` to the backend port. `ROLEGRAPH_DATA_DIR` and `ROLEGRAPH_BACKUP_DIR` default to a gitignored `.data/` in the checkout, so each git worktree gets its own throwaway data. `ROLEGRAPH_PORT` and `VITE_PORT` let parallel worktrees avoid each other.

## Considered Options

- **A local app on each laptop, with snapshots carried between machines through a synced folder.** This was the ticket's starting assumption. Rejected: with an always-on server, a single live instance removes divergence, conflicted copies and the "last export" guard.
- **nginx plus an API container.** Rejected: two images and an nginx config to look after, for one user.
- **Docker for development too.** Rejected: file watching through Docker Desktop on macOS is slow. Playwright, mutmut and the factory's worktrees all run natively anyway.
- **Building on the server from a git checkout, or Watchtower on `:latest`.** Rejected: the first gives no published versions. The second would let every factory merge migrate the real database unattended.
- **Exposure through the reverse proxy with proxy auth, or a login in the app.** Rejected for v1: LAN-only keeps "no auth" honest.

## Consequences

- The map's "localhost" becomes "LAN": agents (#16) reach the API at the server's LAN address.
- Internet exposure would need auth first. That is a new decision, not a config change.
- CI gains an image-publish job (`docker/build-push-action`, linux/amd64) next to the `./check` gates.
