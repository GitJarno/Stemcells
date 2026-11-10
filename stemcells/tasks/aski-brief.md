# The brief: what an ask and a landing carry

An ask showed the Cell's own last paragraph and nothing else, and a Cell
that said `Done:` was believed. This page decides what stands beside the
Cell's words: what it was told to do, and what its run shows.

## Decisions

### 1. Facts from T3's own records, no model

Everything below is read from records upstream already keeps, once per
run, where the ask's detail is read (`needs/Needs.ts`). Nothing is stored
and no model is called: a fact the person can check beats a summary they
have to trust.

- **Goal.** The instruction the Cell is on: the person's (or Aski's) last
  message of substance before the run ended. A short follow-up ("yes, go
  ahead") is not an instruction, so the one before it stands. Wakes and
  notifications are never one.
- **Changed.** Files and lines the run changed, from its checkpoints.
- **Checks.** The run's own test, typecheck, lint and build commands, each
  kind's last outcome, failed by upstream's own rule for a failed command.
- **Pull request.** The Cell's linked pull request: its state, its checks
  and whether it conflicts, from upstream's snapshot.

### 2. A landing says how it landed

A finished Cell has a verdict, by rule:

| Verdict  | When                                                                                              | Wire      |
| -------- | ------------------------------------------------------------------------------------------------- | --------- |
| Shown    | Its pull request merged or its checks pass, or its own checks last ran clean                      | `shown`   |
| Its word | It says it is done and nothing above shows it                                                     | `claimed` |
| Short    | The run was stopped or rolled back, a check it ran last failed, or its pull request's checks fail | `short`   |

A failing fact outranks a passing one, and both outrank the Cell's word.
A run stopped by hand, cancelled or rolled back used to read as done with
no line; it now lands short and says why.

### 3. Where it shows

- **An ask**, on the Mac and the phone: the goal over the Cell's words,
  and one line of facts under the ask (lines changed with a five-cell bar,
  checks, pull request). A fact that is missing is left out, never
  guessed.
- **`stemcells_standing`**, so Aski answers "how is it going" with what
  the run shows, not only what the Cell said.
- **The needs list's `cells`**: each done Cell's verdict and the fact
  behind it, for the room's board (next).

## Slices

- [x] 1. Server: `needs/evidence.ts` and `needs/verdict.ts` (pure), read in
      `upstream/needs.ts`, carried on `Need.brief` and `CellStanding`.
- [x] 2. The ask on the Mac and the phone shows the goal and the facts.
- [x] 3. `stemcells_standing` says each Cell's verdict.

## Review

- Run in a lab on a real server with Replay Cells: one that ran its tests
  and finished stands `shown` on `checks-clean`, and one that asked shows
  the instruction it was given on its card.
- The pull request's checks move after a run ends, so the pull request is
  read off the shell on every list and only the run's own records are
  kept. A failed read of them leaves the ask without facts; it is not
  read again for them.
- A command piped through `tail` reports the pipe's end, not the test's:
  a failing run can read as clean. The check is upstream's own rule for a
  failed command, the one its chat marks a command by, so the card and the
  chat agree.
- The tool's description and Aski's persona are unchanged: they are text
  a model reads, and their evals cost money to run. The report's new words
  say what they mean on their own.

## Next

- Aski's room as a board of runs, drawn from `cells`.
- A push that carries the ask itself and lands on its card.
