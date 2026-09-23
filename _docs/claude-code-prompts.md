# Claude Code prompt log

Prompts entered in Claude Code for SplitLedger, transcribed from the conversation and shared Claude Code output. This is a workflow record, not the product specification or a homework answer. Line wrapping in the terminal transcript has been normalized.

## Project orientation (before Question 4)

```text
I work on my second homework https://github.com/GerhardBalz-Admin/adtz-02-splitledger.git similar to adtz-01-household-chores
```

Claude Code cloned and inspected the repository, then described the remaining homework work.

## Question 4: design sketch

```text
/design Read _docs/specs.md and sketch the main SplitLedger screens. Show me the artboards before implementation.
```

Result: [SplitLedger design canvas](https://claude.ai/artifact/6X7AnnKpUKMTgNmQqYR3e4) with six linked desktop artboards.

## Question 4: frontend implementation

Claude Code located the following verbatim prompt in both its local `~/.claude/history.jsonl` and the transcript of session `745ecfb7-5953-45ab-a1d2-b64bee611196`. It reported that the prompt was entered on 2026-09-23 at 12:07:34 UTC from `C:\\Users\\gerha\\adtz-02-splitledger`.

```text
Implement the frontend for the app described in _docs/specs.md, using the SplitLedger artboard I selected:
https://claude.ai/artifact/6X7AnnKpUKMTgNmQqYR3e4

Put it in frontend/. Don't implement the backend yet. Centralize all backend calls in one place and mock them for now. Make the UI interactive so I can use the main features from the spec.

For this homework implementation, use the three defaults listed in the spec and allocate leftover cents to selected members in group join order. Adapt the selected desktop design to phone widths.

Run the frontend, verify the main flows, and report the exact start command. Once verified, record the Question 4 answer in _docs/homework-answers.md, then commit and push.
```

The frontend prototype was subsequently built, tested, and pushed.

## Question 4: stop the development server

```text
how to stop the frontend?
```

Claude Code stopped its running `npm run dev` task and explained how to stop a locally started server.

## Before Question 5: synchronize the checkout

```text
Before starting Question 5, synchronize my local SplitLedger checkout with GitHub.

From the repository root, check the current branch and working-tree status. If it is clean and on main, run git pull --ff-only origin main. If there are local changes or the pull cannot fast-forward, stop and show me the details; do not discard or overwrite anything.

Verify that _docs/specs.md records this accepted rule: only the group creator may change the currency before the first expense, and the currency is locked afterward. Report the resulting HEAD commit and working-tree status. Do not implement Question 5 yet.
```

Claude Code reported a clean fast-forward from `5bd49dd` to `33f6b7bbdf0b83b348e7a9a3c157e29ab562522c`, verified the accepted currency rule, and did not start Question 5.

## Question 5

The following prompt was entered in Claude Code, as shown in the shared Question 5 transcript (terminal indentation normalized):

```text
Let's do Homework 2 Question 5.

Read _docs/specs.md, AGENTS.md, and the existing frontend API and mock-backend code. First create openapi.yaml as the contract for the features the frontend needs. Then implement a FastAPI backend in backend/ from that contract.

Use uv for Python dependency management and an in-memory mock database for now; SQLAlchemy and SQLite belong to Question 7. Write endpoint tests first, then implement and run them.

Enforce the spec's permissions and balance rules in the backend, including creator-only currency changes before the first expense. Keep backend calls centralized in the frontend, but do not connect the frontend to the real backend yet; that is Question 6.

Document the actual backend start and test commands, record the Question 5 answer, and report test results and any deliberate gaps. Commit and push the completed Question 5 changes.
```

Claude Code reported pushing the contract and FastAPI mock-database backend in commit `9dd1915`, with 85 backend tests passing. It recorded the backend start command in [the homework answers](homework-answers.md). The frontend still uses its in-browser mock; database persistence is deferred to Question 7.

**Follow-up before Question 6:** The current backend test permits changing currency after all expenses are deleted, whereas [accepted decision 3](specs.md#accepted-decisions) says it is locked after the first expense was recorded. Reconcile the behavior, test, and frontend mock with the accepted decision before connecting the frontend.

