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

## Contributing

The repository is public to read. Pull requests are accepted only from
collaborators invited by the maintainer. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
