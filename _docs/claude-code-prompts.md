# Claude Code prompt log

Prompts entered in Claude Code for Homework 2 (SplitLedger). This is a workflow record, not the product specification or a homework answer. Each prompt is transcribed verbatim, with its line breaks, from the original Claude Code session transcripts and cross-checked against Claude Code's local prompt history. Outcomes and commit references are given only where the transcripts verify them. For the full sanitized dialogue and tool activity of the same sessions, see the [Claude Code conversation transcript](claude-code-conversation.md).

## Prompts

### Session `8fa56825-d817-4b21-8a31-fc6b59021218` (2026-09-23)

Started in the home directory (`~`), before the repository was cloned.

#### 1. List the home directory

2026-09-23 13:43:39 +02:00

```text
ls
```

Outcome: Claude listed the home directory. The listing is redacted in the conversation transcript.

#### 2. Project orientation

2026-09-23 13:45:53 +02:00

```text
I work on my second homework https://github.com/GerhardBalz-Admin/adtz-02-splitledger.git similar to adtz-01-household-chores
```

Outcome: Claude cloned and inspected the repository, then described the remaining homework work (Questions 4–7), noted that Node.js was not installed, and suggested accepting the spec's three design defaults.

#### 3. Question 4: design sketch

2026-09-23 13:51:18 +02:00 · `/design` slash command

```text
/design Read _docs/specs.md and sketch the main SplitLedger screens. Show me the artboards before implementation.
```

Outcome: [SplitLedger design canvas](https://claude.ai/artifact/6X7AnnKpUKMTgNmQqYR3e4) with six linked desktop artboards.

### Session `745ecfb7-5953-45ab-a1d2-b64bee611196` (2026-09-23)

Started in the repository root.

#### 4. Question 4: frontend implementation

2026-09-23 14:07:34 +02:00 · pasted

```text
Implement the frontend for the app described in _docs/specs.md, using the SplitLedger artboard I selected:
https://claude.ai/artifact/6X7AnnKpUKMTgNmQqYR3e4

Put it in frontend/. Don't implement the backend yet. Centralize all backend calls in one place and mock them for now. Make the UI interactive so I can use the main features from the spec.

For this homework implementation, use the three defaults listed in the spec and allocate leftover cents to selected members in group join order. Adapt the selected desktop design to phone widths.

Run the frontend, verify the main flows, and report the exact start command. Once verified, record the Question 4 answer in _docs/homework-answers.md, then commit and push.
```

Outcome: Claude built the React frontend with a mocked backend, reported 17 passing unit tests and browser checks at desktop and phone widths, and pushed commit `5bd49dd`.

#### 5. Question 4: stop the development server

2026-09-23 14:34:17 +02:00

```text
how to stop the frontend?
```

Outcome: Claude stopped its running `npm run dev` task and explained how to stop a locally started server.

#### 6. Before Question 5: synchronize the checkout

2026-09-23 14:38:39 +02:00 · pasted

```text
Before starting Question 5, synchronize my local SplitLedger checkout with GitHub.

From the repository root, check the current branch and working-tree status. If it is clean and on main, run `git pull --ff-only origin main`. If there are local changes or the pull cannot fast-forward, stop and show me the details; do not discard or overwrite anything.

Verify that _docs/specs.md records this accepted rule: only the group creator may change the currency before the first expense, and the currency is locked afterward. Report the resulting HEAD commit and working-tree status. Do not implement Question 5 yet.
```

Outcome: Claude reported a clean fast-forward from `5bd49dd` to `33f6b7bbdf0b83b348e7a9a3c157e29ab562522c`, verified the accepted currency rule, and did not start Question 5.

#### 7. Question 5

2026-09-23 14:41:52 +02:00 · pasted

```text
Let's do Homework 2 Question 5.

Read _docs/specs.md, AGENTS.md, and the existing frontend API and mock-backend code. First create openapi.yaml as the contract for the features the frontend needs. Then implement a FastAPI backend in backend/ from that contract.

Use uv for Python dependency management and an in-memory mock database for now; SQLAlchemy and SQLite belong to Question 7. Write endpoint tests first, then implement and run them.

Enforce the spec's permissions and balance rules in the backend, including creator-only currency changes before the first expense. Keep backend calls centralized in the frontend, but do not connect the frontend to the real backend yet; that is Question 6.

Document the actual backend start and test commands, record the Question 5 answer, and report test results and any deliberate gaps. Commit and push the completed Question 5 changes.
```

Outcome: Claude pushed the contract and FastAPI mock-database backend in commit `9dd1915`, with 85 backend tests passing. It recorded the backend start command in [the homework answers](homework-answers.md). The frontend still uses its in-browser mock; database persistence is deferred to Question 7.

**Follow-up before Question 6:** The backend as committed in `9dd1915` permitted changing the currency after all expenses were deleted, whereas [accepted decision 3](specs.md#accepted-decisions) says it is locked after the first expense was recorded. Commit `fbf6627` ("Keep group currency locked after first recorded expense") changes the backend, tests, frontend mock and contract accordingly, but no local Claude Code session records that work (see below).

## Sources and gaps

- Sources checked: `~/.claude/history.jsonl` and every session transcript under `~/.claude/projects/` (the home-directory and repository project folders).
- All seven prompts above are taken from the two session transcripts and match `history.jsonl` exactly. Timestamps come from the transcripts (UTC) and are shown in local time (+02:00). "Pasted" marks prompts entered by pasting text.
- Prompt 3 is stored in the transcript as a slash-command record; it is shown here as typed, which is also how the prompt history records it.
- Not listed because they are not prompts to Claude: `exit`, which ended session `8fa56825…` at 14:42:21, and `/clear`, which ended session `745ecfb7…` at 15:27:38. Both appear only in the prompt history.
- **Gap:** application commit `fbf6627` appears in no local Claude Code transcript, so no prompt or conversation is recorded for it.
- Excluded sessions: `56fad681…` (finding the Question 4 prompt for this log), `c076f5a1…` (checkout verification only; no development), the session that produced this record, and the Homework 1 sessions `ec7765e9…`, `b45f1efe…` and `abc5d6e3…`.
- Corrections to the earlier version of this log: added prompt 1 (`ls`), restored the backticks in prompt 6, added timestamps and session identifiers, and removed a local path.
- No prompt contains credentials or other secrets.
