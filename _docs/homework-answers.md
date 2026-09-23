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

Run it from `frontend/` after `npm install`. It serves the prototype at http://localhost:5173. The [frontend](../frontend/README.md) is a React + Vite + TypeScript app based on the SplitLedger design canvas. All backend calls go through `frontend/src/api/client.ts`, which currently uses an in-browser mock backend stored in `localStorage`. The main flows were verified in a browser at desktop and phone widths.

## Question 5: Backend

```bash
uv run uvicorn splitledger_backend.main:app --reload
```

Run it from `backend/`. It serves the API at http://localhost:8000/api and interactive docs at http://localhost:8000/docs. The [backend](../backend/README.md) is a FastAPI app managed with uv. It implements the [`openapi.yaml`](../openapi.yaml) contract, which was written first from the frontend's centralized API client. It uses an in-memory mock database for now. The endpoint tests were written before the implementation, and all of them pass with `uv run pytest`. The frontend is not connected to it yet.

## Question 6: Frontend–backend connection

Pending implementation. Record the frontend's actual backend URL after integration.

## Question 7: Database and tests

Pending implementation. Record the actual test command after adding SQLAlchemy persistence and running the tests.
