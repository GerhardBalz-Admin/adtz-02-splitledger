# SplitLedger backend

FastAPI backend for SplitLedger. It implements the contract in [`../openapi.yaml`](../openapi.yaml). For now it keeps its data in an in-memory mock database, which is lost when the server stops. SQLAlchemy with SQLite replaces it in Question 7.

## Commands

Run these from `backend/`. [uv](https://docs.astral.sh/uv/) installs Python and the dependencies on first use.

```bash
uv sync                                                        # install dependencies
uv run uvicorn splitledger_backend.main:app --reload           # start at http://localhost:8000
uv run pytest                                                  # run the tests
```

The API lives under `http://localhost:8000/api`. Interactive docs are at http://localhost:8000/docs.

### Settings

| Environment variable | Default | Effect |
| --- | --- | --- |
| `SPLITLEDGER_DEMO_DATA` | `1` | Seed the demo data at start-up. Set to `0` to start empty. |
| `SPLITLEDGER_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Browser origins allowed to call the API. |

The demo data matches the frontend mock. The accounts are `dana@example.com`, `anna@example.com`, `ben@example.com` and `chiara@example.com`, all with the password `splitledger`. Dana created *Flat 4B*, whose invite code is `K7QM-4RX2`.

## Layout

| File | Purpose |
| --- | --- |
| `src/splitledger_backend/main.py` | `create_app()` factory and the module-level `app` |
| `src/splitledger_backend/routes/` | `auth`, `groups` and `expenses` endpoints, including the permission rules |
| `src/splitledger_backend/deps.py` | Bearer-token user lookup and the member-only group lookup |
| `src/splitledger_backend/money.py` | Equal split and net balance calculation in minor units |
| `src/splitledger_backend/database.py` | In-memory mock database (to be replaced in Question 7) |
| `src/splitledger_backend/schemas.py` | Pydantic request and response models with camelCase JSON |
| `src/splitledger_backend/errors.py` | Returns validation errors as `{"detail": "<message>"}` |
| `src/splitledger_backend/seed.py` | Demo data |
| `tests/` | Endpoint, money-rule and contract tests |

## Rules enforced

- Authenticated endpoints need `Authorization: Bearer <token>` and answer `401` otherwise. Passwords are stored as salted PBKDF2 hashes.
- A user sees only the groups they belong to. A nonmember gets `404` for a group and everything in it, the same response as for a group that does not exist.
- Only the group creator receives `inviteCode`. Joining with a code the user already used creates no duplicate membership, and an unknown code returns `404`.
- Only the creator may change the currency (`403` otherwise), and only before the first expense is recorded (`409` afterward, even if all expenses are deleted). `currencyLocked` in group detail reflects this permanent lock.
- The payer is always the signed-in user; any payer field in the request body is ignored. Participants must be distinct current members of the group. Amounts are positive integers of minor units, and dates are `YYYY-MM-DD`.
- Only the expense's creator may edit or delete it (`403` otherwise).
- Balances are the amount paid minus allocated shares. Leftover cents go to the selected members in group join order, so balances in a group always sum to zero.

`tests/test_contract.py` checks that the app's operations, success status codes and response fields match `openapi.yaml`.
