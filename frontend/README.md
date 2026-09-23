# SplitLedger frontend

React + Vite + TypeScript frontend of SplitLedger, based on the SplitLedger design canvas. It adapts the desktop screens to phone widths and talks to the FastAPI backend in [`../backend`](../backend/README.md).

## Commands

Start the backend first (from `backend/`: `uv run uvicorn splitledger_backend.main:app --reload`). Then run these from `frontend/` (Node.js 20 or newer):

```bash
npm install
npm run dev        # start the app at http://localhost:5173
npm test           # run the unit tests (Vitest)
npm run build      # typecheck and build to dist/
```

## Backend connection

Every backend call goes through [`src/api/client.ts`](src/api/client.ts). Its `request` function sends each call with `fetch` to the API base URL:

```text
http://localhost:8000/api
```

To use another backend, set `VITE_API_BASE_URL` before starting or building, for example `VITE_API_BASE_URL=http://127.0.0.1:9000/api npm run dev`. The backend allows browser requests from `http://localhost:5173` and `http://127.0.0.1:5173`; set `SPLITLEDGER_CORS_ORIGINS` there when the frontend runs elsewhere.

The client sends the session token as `Authorization: Bearer <token>` and keeps it in `localStorage`. When the backend rejects the token, for example after the user signs out elsewhere or the backend database is reset, the client forgets it and the app returns to the sign-in page. If the backend is not running, forms show "Cannot reach the SplitLedger backend at http://localhost:8000/api".

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/signup`, `/auth/signin`, `/auth/signout` | Account and session |
| GET | `/auth/me` | Current user |
| GET, POST | `/groups` | List my groups, create a group |
| POST | `/groups/join` | Join by invite code (no duplicate membership) |
| GET, PATCH | `/groups/{id}` | Group detail with balances; change currency |
| POST | `/groups/{id}/expenses` | Add an expense (payer = signed-in user) |
| PATCH, DELETE | `/groups/{id}/expenses/{expenseId}` | Edit or delete your own expense |

The paths and payloads follow the contract in [`../openapi.yaml`](../openapi.yaml).

Demo accounts, seeded by the backend: `dana@example.com`, `anna@example.com`, `ben@example.com`, `chiara@example.com`. They all use the password `splitledger`. Dana created *Flat 4B*, whose invite code is `K7QM-4RX2`.

## Unit tests

The unit tests do not need a running backend. [`src/test/mockFetch.ts`](src/test/mockFetch.ts) replaces `fetch` and routes the client's requests to [`src/test/mockServer.ts`](src/test/mockServer.ts), an in-memory copy of the backend's rules. The tests also check the request URLs, the `Authorization` header, and the error shown when the backend cannot be reached.

## Money rules

Amounts are integer minor units (cents). [`src/lib/split.ts`](src/lib/split.ts) splits each expense equally among the selected members. Any leftover cents go one each to the selected members in group join order, so the shares always add up to the total and group balances sum to zero.
