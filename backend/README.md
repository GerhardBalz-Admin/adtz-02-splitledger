# SplitLedger backend

FastAPI backend for SplitLedger. It implements the contract in [`../openapi.yaml`](../openapi.yaml) and stores its data with SQLAlchemy. Locally that is a SQLite file, `splitledger.sqlite3` in `backend/`, so accounts, groups and expenses survive a restart. Any other database SQLAlchemy supports can be used by changing the URL.

## Commands

Run these from `backend/`. [uv](https://docs.astral.sh/uv/) installs Python and the dependencies on first use.

```bash
uv sync                                                        # install dependencies
uv run uvicorn splitledger_backend.main:app --reload           # start at http://localhost:8000
uv run pytest                                                  # run the tests
```

The server creates the database tables on start-up if they are missing. To start over with a fresh database, stop the server and delete `splitledger.sqlite3`. The tests never touch that file: each test uses its own SQLite file in a temporary directory.

The API lives under `http://localhost:8000/api`. Interactive docs are at http://localhost:8000/docs.

### Settings

| Environment variable | Default | Effect |
| --- | --- | --- |
| `SPLITLEDGER_DATABASE_URL` | `sqlite:///./splitledger.sqlite3` | SQLAlchemy database URL. A relative SQLite path is relative to the directory the server starts in. Other databases also need their driver installed, e.g. `uv add psycopg` for `postgresql+psycopg://…`. |
| `SPLITLEDGER_DEMO_DATA` | `1` | Add the demo data when the server starts with an empty database. Set to `0` to start empty. A database that already has accounts is never seeded again. |
| `SPLITLEDGER_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Browser origins allowed to call the API. |

The frontend in [`../frontend`](../frontend/README.md) calls this API at `http://localhost:8000/api`. The demo data matches the frontend's test mock. The accounts are `dana@example.com`, `anna@example.com`, `ben@example.com` and `chiara@example.com`, all with the password `splitledger`. Dana created *Flat 4B*, whose invite code is `K7QM-4RX2`.

## Layout

| File | Purpose |
| --- | --- |
| `src/splitledger_backend/main.py` | `create_app()` factory and the module-level `app` |
| `src/splitledger_backend/routes/` | `auth`, `groups` and `expenses` endpoints, including the permission rules |
| `src/splitledger_backend/deps.py` | Bearer-token user lookup and the member-only group lookup |
| `src/splitledger_backend/money.py` | Equal split and net balance calculation in minor units |
| `src/splitledger_backend/database.py` | SQLAlchemy tables, the `Database` engine wrapper and the per-request `Store` |
| `src/splitledger_backend/schemas.py` | Pydantic request and response models with camelCase JSON |
| `src/splitledger_backend/errors.py` | Returns validation errors as `{"detail": "<message>"}` |
| `src/splitledger_backend/seed.py` | Demo data |
| `tests/` | Endpoint, money-rule, contract, and persistence and restart tests |

## Rules enforced

- Authenticated endpoints need `Authorization: Bearer <token>` and answer `401` otherwise. Passwords are stored as salted PBKDF2 hashes, and session tokens only as SHA-256 digests. Tokens stay valid across restarts until the user signs out.
- A user sees only the groups they belong to. A nonmember gets `404` for a group and everything in it, the same response as for a group that does not exist.
- Only the group creator receives `inviteCode`. Joining with a code the user already used creates no duplicate membership, and an unknown code returns `404`.
- Only the creator may change the currency (`403` otherwise), and only before the first expense is recorded (`409` afterward, even if all expenses are deleted). `currencyLocked` in group detail reflects this permanent lock, which is stored with the group.
- The payer is always the signed-in user; any payer field in the request body is ignored. Participants must be distinct current members of the group. Amounts are positive integers of minor units, and dates are `YYYY-MM-DD`.
- Only the expense's creator may edit or delete it (`403` otherwise).
- Balances are the amount paid minus allocated shares. Leftover cents go to the selected members in group join order, so balances in a group always sum to zero.

`tests/test_contract.py` checks that the app's operations, success status codes and response fields match `openapi.yaml`. `tests/test_persistence.py` starts the app the way uvicorn does, writes data, starts a new app on the same database file, and checks that the data, tokens, balances, join order, permissions and currency lock are unchanged.
