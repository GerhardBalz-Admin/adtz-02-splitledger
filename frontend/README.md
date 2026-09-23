# SplitLedger frontend

React + Vite + TypeScript prototype of SplitLedger, based on the SplitLedger design canvas. It adapts the desktop screens to phone widths.

## Commands

Run these from `frontend/` (Node.js 20 or newer):

```bash
npm install
npm run dev        # start the app at http://localhost:5173
npm test           # run the unit tests (Vitest)
npm run build      # typecheck and build to dist/
```

## Mocked backend

There is no real backend yet. Every backend call goes through [`src/api/client.ts`](src/api/client.ts). Its `request` function passes each call to [`src/api/mockServer.ts`](src/api/mockServer.ts), an in-browser mock of the planned REST API:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/signup`, `/auth/signin`, `/auth/signout` | Account and session |
| GET | `/auth/me` | Current user |
| GET, POST | `/groups` | List my groups, create a group |
| POST | `/groups/join` | Join by invite code (no duplicate membership) |
| GET, PATCH | `/groups/{id}` | Group detail with balances; change currency |
| POST | `/groups/{id}/expenses` | Add an expense (payer = signed-in user) |
| PATCH, DELETE | `/groups/{id}/expenses/{expenseId}` | Edit or delete your own expense |

The mock enforces the spec rules: nonmembers get 404, only the creator receives the invite code, only an expense's creator can change it, and the currency is locked once expenses exist. It stores its data in `localStorage`, so data survives a reload. **Reset demo data** on the sign-in page restores the seed data.

Demo accounts: `dana@example.com`, `anna@example.com`, `ben@example.com`, `chiara@example.com`. They all use the password `splitledger`. Dana created *Flat 4B*, whose invite code is `K7QM-4RX2`.

## Money rules

Amounts are integer minor units (cents). [`src/lib/split.ts`](src/lib/split.ts) splits each expense equally among the selected members. Any leftover cents go one each to the selected members in group join order, so the shares always add up to the total and group balances sum to zero.
