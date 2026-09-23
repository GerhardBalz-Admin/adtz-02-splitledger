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

No Question 5 Claude Code execution has been confirmed in the shared transcript. Add its **actual entered prompt** and result here after it runs; do not label a suggested prompt as executed.
