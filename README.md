# AccraFloodWatch Workspace

This workspace currently has three main areas:

- `frontend/` for the TanStack Start frontend app
- `backend/` for the runtime FastAPI backend
- `ML/` for training and research files

## Frontend

The frontend lockfile is `bun.lock`, so Bun is the authoritative package manager
for dependency installation.

```bash
cd frontend
bun install
```

Create a local `.env` from `.env.example` and set:

```bash
ML_API_URL=http://127.0.0.1:8000
```

Then run the frontend:

```bash
bun run dev
```

## Backend

From the workspace root:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Optional backend environment:

```bash
BACKEND_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

See `backend/README.md` for backend-specific runtime notes.
