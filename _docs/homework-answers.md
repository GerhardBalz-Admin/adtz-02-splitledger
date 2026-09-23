# Homework 2 answers

Answers to the [2026 Homework 2 questions](https://github.com/DataTalksClub/ai-dev-tools-zoomcamp/blob/main/cohorts/2026/homework/02-development/homework.md). This file tracks progress; it is not a course submission.

## Question 1: Project

**Expense splitter.**

## Question 2: Spec and name

**SplitLedger.** The accepted [product specification](specs.md) describes the groups, expenses, equal shares, and net balances.

## Question 3: GitHub repository and setup commit

[SplitLedger repository](https://github.com/GerhardBalz-Admin/adtz-02-splitledger). The required spec, `.gitignore`, `README.md`, and `AGENTS.md` were committed in several steps. The [final setup commit](https://github.com/GerhardBalz-Admin/adtz-02-splitledger/commit/3a04a0e3d05f62da2415e28722c583c8c46e87d7) has SHA-1:

```text
3a04a0e3d05f62da2415e28722c583c8c46e87d7
```

It also includes `CLAUDE.md`, which points to `AGENTS.md`. This is the last commit of the initial repository setup, before later documentation updates.

## Question 4: Frontend prototype

```bash
npm run dev
```

Run it from `frontend/` after `npm install`. It serves the prototype at http://localhost:5173. The [frontend](../frontend/README.md) is a React + Vite + TypeScript app based on the SplitLedger design canvas. All backend calls go through `frontend/src/api/client.ts`, which at that stage used an in-browser mock backend stored in `localStorage`. The main flows were verified in a browser at desktop and phone widths.

## Question 5: Backend

```bash
uv run uvicorn splitledger_backend.main:app --reload
```

Run it from `backend/`. It serves the API at http://localhost:8000/api and interactive docs at http://localhost:8000/docs. The [backend](../backend/README.md) is a FastAPI app managed with uv. It implements the [`openapi.yaml`](../openapi.yaml) contract, which was written first from the frontend's centralized API client. It uses an in-memory mock database for now. The endpoint tests were written before the implementation, and all of them pass with `uv run pytest`. The frontend is connected to it in Question 6.

## Question 6: Frontend–backend connection

```text
http://localhost:8000/api
```

The frontend sends every backend call from `frontend/src/api/client.ts` with `fetch` to this base URL, for example `POST http://localhost:8000/api/auth/signin` and `GET http://localhost:8000/api/groups`. `VITE_API_BASE_URL` can override it. The backend allows browser requests from the Vite dev server at http://localhost:5173.

Run the backend from `backend/` with `uv run uvicorn splitledger_backend.main:app --reload`, then the frontend from `frontend/` with `npm install` and `npm run dev`, and open http://localhost:5173.

The connection was verified in a headless Chromium browser against both running servers. All 46 requests the app made went to `http://localhost:8000/api`. Two users in separate browsers, one at phone width, signed in, created a group, joined it by code, and added, edited and deleted an expense. The group and expense were then read back directly from the backend API, and each user's changes appeared in the other's browser. After sign-out, the backend rejected the old token. With the backend stopped, the sign-in form reports that it cannot reach the backend. The unit tests (19 frontend, 85 backend) pass. The in-browser mock is now used only by the frontend unit tests.

## Question 7: Database and tests

```bash
uv run pytest
```

Run it from `backend/` (after `uv sync` on a new checkout). The backend now stores its data with SQLAlchemy 2.0 instead of the in-memory mock. Locally it uses a SQLite file, `backend/splitledger.sqlite3`, which is not committed. The app stays database-agnostic: it uses only portable SQLAlchemy column types, stores timestamps as UTC, and reads the database URL from `SPLITLEDGER_DATABASE_URL`. The API contract, permissions, balance rules, join-order splits and the permanent currency lock are unchanged. The lock is stored with the group, so it survives deleting every expense and restarting the server. Session tokens are also stored, as SHA-256 digests, so signed-in users stay signed in after a restart.

Each test gets its own SQLite file in a temporary directory, so tests are isolated and never touch the local database. The 85 earlier backend tests pass unchanged apart from their fixtures. Nine new tests in `backend/tests/test_persistence.py` start the app the way uvicorn does, stop it, start it again on the same file, and check the data. All 94 backend tests pass, and the 19 frontend unit tests still pass with `npm test`. A manual check with uvicorn gave the same result: an expense and an account created before a restart were still there afterwards, the old token still worked, and the balances still summed to zero.

Claude recommended these further tests, which are not implemented yet:

- Run the backend suite against a second database, such as PostgreSQL, to show in practice that the app is database-agnostic. So far only SQLite is tested.
- Test simultaneous requests: two sign-ups with the same email, or two joins with the same code. The database's unique constraints handle these, but no test covers them.
- Add schema migrations (for example Alembic) with an upgrade test before the table layout changes. Start-up currently creates only missing tables.
- Add a browser end-to-end test that uses the app, restarts the backend, and checks that the frontend shows the same data.
