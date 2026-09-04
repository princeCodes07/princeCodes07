# Backend Runtime Notes

This backend is intended to run from the self-contained `backend/` tree:

- `backend/app`
- `backend/models`
- `backend/data`

The runtime backend does not require the research and training files under `ML/`.

## Python

Local runtime validation for this repository was performed with Python `3.13`.

## Start Command

```bash
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

## Optional Environment

- `BACKEND_CORS_ORIGINS`
  Comma-separated list of additional allowed frontend origins. Local development
  origins are already allowed by default.

## Optional Test Tooling

This backend does not require HTTP client testing packages at runtime.

If you want to use `starlette.testclient` in the current local Python environment,
the installed Starlette build looks for `httpx2` first and can fall back to
`httpx` with a deprecation warning. Do not add either package to
`backend/requirements.txt` unless you are introducing a real backend test suite.
