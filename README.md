# rolegraph

A personal knowledge graph of the recruitment processes I take part in.

rolegraph keeps the state and history of every hiring process, a record of each
interview, and the people involved, so they can be looked up later.

## Model (planned)

Processes are organised as a tree of roles:

```
Software Engineer                 ← role family (root)
├── AI Software Engineer          ← specialization (branch)
│   ├── Acme Corp — timeline      ← one process per company (leaf)
│   └── Globex — timeline
└── Java Software Engineer
    └── Initech — timeline
```

Each leaf is a timeline of stage changes and interviews. People (recruiters,
interviewers, hiring managers) are linked to the processes they took part in.

## Stack

| Part       | Tech                                   | Folder                     |
|------------|----------------------------------------|----------------------------|
| Backend    | Python, FastAPI, uv                    | [`backend/`](backend/)     |
| Frontend   | React, TypeScript, Vite                | [`frontend/`](frontend/)   |
| Docs       | Design notes and specs                 | [`docs/`](docs/)           |

## Development

Backend (http://localhost:8000, API docs at `/docs`):

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

Frontend (http://localhost:5173):

```bash
cd frontend
npm install
npm run dev
```

Tests:

```bash
cd backend && uv run pytest
```

## Running (planned)

These are decided but not built yet. See ADRs 0009–0011 in [`docs/adr/`](docs/adr/).

- **Develop**: `./dev` starts the backend with reload and Vite together. Data goes to a gitignored `.data/` in the checkout.
- **Run at home**: one Docker image on a server on your LAN, with no login, so keep it off the internet. Set `ROLEGRAPH_BIND` to the server's LAN address, then `docker compose pull && docker compose up -d` with the root `compose.yaml`. Bind-mount `/backups` to a disk other than the data volume, for example a folder that Nextcloud shows as External Storage.
- **Backups**: one is made automatically for each day with a change, and the last 14 of those are kept. "Back up now" Backups, and the ones made before upgrades and Restores, are kept forever. Restore replaces all data.

## Demo mode (planned)

To show rolegraph to someone, or to try it without entering your own data, open **Help → Demo mode**. That browser then sees a made-up set of Roles, Companies, People and Processes, kept wholly apart from your real data, which other devices keep seeing. You can edit the demo data freely, and **Help → Reset demo data** puts it back. Backups don't include demo data. A fresh install offers "Explore with demo data" next to "Add your first Role".

## Contributing

The repository is public to read. Pull requests are accepted only from
collaborators invited by the maintainer. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
