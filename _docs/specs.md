# SplitLedger — Homework 2 specification

**Status:** Accepted for Homework 2 Question 2 on 2026-09-23; implementation defaults remain to be resolved during design.  
**Purpose:** AI Dev Tools Zoomcamp 2026, Homework 2 learning exercise. This is not a final-project selection or a continuation of another project.

## Product goal

SplitLedger helps signed-in members of small groups record shared expenses and see each member's net balance. One account may belong to multiple groups. Each group keeps its own members, currency, expenses, and balances.

## Accepted decisions

1. A signed-in user may create and belong to multiple groups.
2. A user joins an existing group by entering its invite code after signing in. Only the group creator can view and copy the code in the app.
3. Every group has one currency, chosen when the group is created; all expenses in that group use it. No conversion occurs.
4. An expense is divided equally among a selected, nonempty subset of that group's members.
5. The signed-in member who enters an expense is its payer. The payer may be excluded from the selected members who share that expense.
6. A member may edit or delete only expenses they created.
7. The app shows each member's net balance. It does not suggest or record repayments.
8. Each expense has a date that defaults to today when entered and may be changed by its creator.

## Core user flows

1. **Account:** Sign up with email and password, then sign in and out.
2. **Create a group:** Enter a group name and choose a currency. The creator becomes a member and can view and copy the invite code to share outside the app. Other members cannot view it in the app.
3. **Join a group:** A signed-in user enters a valid invite code and becomes a member. Re-entering the same code does not create duplicate membership.
4. **View groups:** A signed-in user sees only groups to which they belong and can open each group's expense list and balances.
5. **Add an expense:** In a group, enter a description and positive amount; select at least one current group member who shares it. The expense date defaults to today but may be changed. The payer is the signed-in member. Save the expense and update the group's balances.
6. **Correct an expense:** Its creator may change its description, amount, date, or selected participants, or delete it. Recalculate balances after every change.
7. **Review balances:** Show the expense list and the signed net balance of each group member in the group's currency. Positive means the member is owed money; negative means the member owes money.

## Balance rule

For each member in a group:

`net balance = amount paid for group expenses − sum of that member's allocated shares`

The sum of all member balances in a group must be zero. Store and calculate money in the currency's minor units (for example, cents), not binary floating point. When an amount cannot be divided evenly, allocate the remaining minor units deterministically among the selected members so every share adds up to the expense total.

**Example:** A pays CHF 90.00 for an expense shared equally by A, B, and C. A's balance becomes +CHF 60.00; B and C each have −CHF 30.00.

## Acceptance checks

- A user can sign up, sign in, create two separate groups, and view only groups they have joined.
- Another signed-in user can join one group with its code; invalid codes do not grant access.
- Only the group creator can view and copy the invite code in the app.
- Group members can view that group's expenses and balances. A nonmember cannot read or change them.
- A member can add an expense with a positive amount, a description, and at least one selected member of the same group.
- A member can enter an earlier expense date and see that date in the expense list.
- The payer is taken from the authenticated account, not from a client-supplied payer field.
- A payer may record an expense shared only by other group members; the payer receives credit for the full amount and no allocated share.
- The equal split handles a non-divisible amount deterministically and preserves every minor unit.
- Adding, editing, and deleting an expense recalculates balances; they always sum to zero per group.
- Only the creator of an expense may edit or delete it; other group members can view it.
- Expense data and group membership remain after an application restart.

## Boundaries for this exercise

- No repayment recommendations, transfers, or settlement tracking.
- No multi-currency expenses or exchange rates within a group.
- No email invitation delivery, payment integration, receipt upload, recurring expense, or real-time synchronization requirement.
- No member removal or group deletion in the first version.
- This repository will be separate from the eventual course final-project decision; no other project is reused here.

## Build and verification expectations

The Homework 2 workflow calls for a frontend prototype with mocked backend calls, followed by an API contract, a FastAPI backend, frontend integration, replacement of the mock store with SQLAlchemy-backed SQLite persistence, and tests. The implementation should document its actual setup, run, and test commands in the repository. Do not treat these implementation details as decisions about the final project.

## Defaults to confirm during design

- Use email/password accounts without email verification for this local exercise.
- Members can join through the invite code without an email from the app.
- Group currency cannot change after expenses have been recorded.

These defaults are design assumptions, not additional user decisions. Resolve them before implementation if they affect the proposed interface or tests.