# SplitLedger

AI Dev Tools Zoomcamp 2026 Homework 2 expense-splitting app.

The accepted product specification is in [`_docs/specs.md`](_docs/specs.md). [Homework 2 answers and progress](_docs/homework-answers.md), the [Claude Code prompt log](_docs/claude-code-prompts.md), and the [Claude Code conversation transcript](_docs/claude-code-conversation.md) for the sanitized development sessions are recorded separately.

## Run the app

Start the backend and the frontend in two terminals, then open http://localhost:5173 and sign in as `dana@example.com` with the password `splitledger`.

```bash
cd backend && uv run uvicorn splitledger_backend.main:app --reload   # terminal 1
cd frontend && npm install && npm run dev                            # terminal 2
```

## Frontend

The React frontend is in [`frontend/`](frontend/README.md). It calls the backend at `http://localhost:8000/api`, so start the backend first.

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
npm test        # unit tests
```

## Backend

The FastAPI backend is in [`backend/`](backend/README.md). It implements the API contract in [`openapi.yaml`](openapi.yaml) and uses an in-memory mock database for now, so its data is lost when it stops.

```bash
cd backend
uv run uvicorn splitledger_backend.main:app --reload   # http://localhost:8000 (API under /api)
uv run pytest
```

## Course materials

- [Module 2 lesson and recording](https://github.com/DataTalksClub/ai-dev-tools-zoomcamp/blob/main/02-development/01-build-and-ship-an-ai-assisted-full-stack-app.md)
- [2026 Homework 2 instructions](https://github.com/DataTalksClub/ai-dev-tools-zoomcamp/blob/main/cohorts/2026/homework/02-development/homework.md)
