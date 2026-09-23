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

The frontend prototype was subsequently built, tested, and pushed. **The exact Claude Code prompt that initiated frontend implementation has not been preserved in the shared transcript**; do not treat the [course's Question 4 example prompt](https://github.com/DataTalksClub/ai-dev-tools-zoomcamp/blob/main/cohorts/2026/homework/02-development/homework.md#question-4-frontend-prototype) as a verbatim record of what was entered.

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
