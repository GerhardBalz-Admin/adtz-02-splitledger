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

Outcome: Claude pushed the contract and FastAPI mock-database backend in commit `9dd1915`, with 85 backend tests passing. It recorded the backend start command in [the homework answers](homework-answers.md). At that point the frontend still used its in-browser mock; database persistence is deferred to Question 7.

**Follow-up before Question 6:** The backend as committed in `9dd1915` permitted changing the currency after all expenses were deleted, whereas [accepted decision 3](specs.md#accepted-decisions) says it is locked after the first expense was recorded. Commit `fbf6627` ("Keep group currency locked after first recorded expense") changes the backend, tests, frontend mock and contract accordingly, but no local Claude Code session records that work (see below).

### Session `0d400f3a-2d58-426f-93ba-e1c6d4600f2a` (2026-09-23) · partial

Started in the repository root with `/clear`. It began by maintaining this record and became a development session with prompt 10. **Partial:** recorded through prompt 10, whose turn is still in progress.

#### 8. Set up the development record

2026-09-23 15:49:10 +02:00 · pasted

```text
Set up the same Claude Code development record approach for Homework 2 (SplitLedger) that Homework 1 now uses.

First check the branch and working-tree status in adtz-02-splitledger. If the tree is clean and the branch is main, run git pull --ff-only origin main. If there are local changes or the pull cannot fast-forward, stop and report the details; do not overwrite or discard anything. Read AGENTS.md, CLAUDE.md, README.md, and _docs/claude-code-prompts.md before editing.

Find the original local Claude Code history and session transcripts relevant to SplitLedger, including sessions that began in my home directory before the repository was cloned. Establish which sessions and turns are Homework 2 development work. Reconcile the existing prompt log against those sources: retain verified content, correct inaccuracies, and add missing prompts in chronological order with their original wording and line breaks. Identify any unavailable source rather than reconstructing a prompt from a recap.

Create _docs/claude-code-conversation.md as a public, sanitized rendering of those development sessions. Preserve the sequence and actual wording of user prompts and visible Claude replies, and include tool calls and results so a reader can follow the work. State the sessions covered, coverage counts, redactions, formatting changes, and omissions at the top. Mark redactions inline. Keep original session files outside this public repository. Inspect the entire output and staged diff for credentials, personal information, local paths, and other sensitive material. If safe publication cannot be established, stop before committing and report the concern.

Add a link to the new conversation file beside the prompt-log link in README.md, preserving any newer README changes. Add a "Claude Code development record" rule to AGENTS.md, following the Homework 1 approach: keep the two files aligned by session ID and coverage using original transcripts as evidence; reconcile earlier completed development sessions at the next checkpoint; mark an unfinished current session as partial in both files; use the same inclusion boundary; label redactions and omissions; report gaps instead of inventing content. Confirm that CLAUDE.md still imports AGENTS.md, without duplicating the rule there.

Verify coverage against the source transcripts and check the rendered Markdown. Change only AGENTS.md, README.md, _docs/claude-code-prompts.md, and the new _docs/claude-code-conversation.md. Do not change application code, specifications, homework answers, or tests, and do not start Question 6. If the checks pass, commit and push the documentation changes. Report the commit hash, sessions covered, counts, gaps, and every redaction or omission.
```

Outcome: Claude found the source sessions, drafted this log and the conversation file, and found that no transcript accounts for commit `fbf6627`. The turn ended with a Claude Code API error ("The response stopped arriving") before the log was written.

#### 9. Resume the development record

2026-09-23 15:59:51 +02:00 · pasted

```text
Continue the interrupted Homework 2 development-record task. The previous response ended with an API error just as you were writing the corrected prompt log. Do not restart the investigation if its scratchpad files and verified findings are still available.

First inspect the branch, working-tree status, and any existing task scratchpad. Preserve all local work. If the tree is clean and on main, you may run git pull --ff-only origin main; if it is dirty, do not pull or reset. Check for newer remote commits before pushing, and stop if they conflict with this task.

Resume from the two source sessions you identified: 8fa56825… and 745ecfb7…. Correct the prompt log's missing ls prompt and restore the backticks in the synchronization prompt from the original transcript. Verify every other prompt and outcome against the original records. Record the gap you found: no local Claude Code session accounts for application commit fbf6627; do not invent a conversation for it.

Finish the sanitized conversation transcript, README link, and AGENTS.md sync rule as originally requested. Reuse your renderer and redaction work where valid. Check session coverage, Markdown structure, the full staged diff, and all redactions, including the home-directory listing, PATH output, and personal name you identified. If safe publication cannot be established, stop before committing and give me the exact concern.

Change only AGENTS.md, README.md, _docs/claude-code-prompts.md, and _docs/claude-code-conversation.md. Do not change application code or start Question 6. If verification passes, commit and push, then report the commit hash, coverage counts, gaps, redactions, and final working-tree status.
```

Outcome: Claude corrected this log, created the conversation file, linked it from the README, added the development-record rule to `AGENTS.md`, and pushed commit `4f0e3fe`.

#### 10. Question 6: connect the frontend to the backend

2026-09-23 16:08:14 +02:00 · pasted

```text
Do Homework 2 Question 6: connect the existing SplitLedger frontend to the FastAPI backend. Read the repository instructions and existing code, then make the connection work.

Verify the connection through the app, using a browser if available. Tell me which URL the frontend uses to talk to the backend, how you verified it, and the commands needed to run both parts. Record the Question 6 answer, then commit and push the verified work.

Do not start Question 7.
```

Outcome: **In progress.** The outcome will be recorded at the next development checkpoint.

## Sources and gaps

- Sources checked: `~/.claude/history.jsonl` and every session transcript under `~/.claude/projects/` (the home-directory and repository project folders).
- All ten prompts above are taken from the three session transcripts and match `history.jsonl` exactly. Timestamps come from the transcripts (UTC) and are shown in local time (+02:00). "Pasted" marks prompts entered by pasting text.
- Prompt 3 is stored in the transcript as a slash-command record; it is shown here as typed, which is also how the prompt history records it.
- Not listed because they are not prompts to Claude: `exit`, which ended session `8fa56825…` at 14:42:21, and `/clear`, which ended session `745ecfb7…` at 15:27:38. Both appear only in the prompt history. The `/clear` that started session `0d400f3a…` at 15:49:06 is also not listed.
- **Gap:** application commit `fbf6627` appears in no local Claude Code transcript, so no prompt or conversation is recorded for it.
- Excluded sessions: `56fad681…` (finding the Question 4 prompt for this log), `c076f5a1…` (checkout verification only; no development), and the Homework 1 sessions `ec7765e9…`, `b45f1efe…` and `abc5d6e3…`. Session `0d400f3a…` is included because it went on to Question 6 development; its earlier record-maintenance turns are included with it.
- Corrections to the earlier version of this log: added prompt 1 (`ls`), restored the backticks in prompt 6, added timestamps and session identifiers, and removed a local path.
- No prompt contains credentials or other secrets.
