# The + and − marks

The editing row of `cell-life.md`: a `+` and a `−` rise at the Cell's
shoulder, each only when its work added or removed lines. That row has them
rise while the Cell edits; the signal below moves them to the landing.

## Signal

- **Per edit: not on the client.** A `file_change` item declares `additions`
  and `deletions`, but neither adapter fills them. Claude's `diffStr` is the
  tool's output, not a diff. The wire projection also strips `diffStr`,
  `oldStr` and `newStr` from every completed change (`WireProjection.ts`).
  Getting counts per edit would take a server change, which is a seam the
  fork has no budget for.
- **Per run: in the checkpoint.** When a turn lands, its checkpoint carries
  git's numstat for each file it changed (`checkpoints[].files`, with
  `additions` and `deletions`). The landing read growth already makes
  (`useCellLanding`) reads it too. A run only reads as completed once its
  checkpoint is captured (`CheckpointCaptureService`), so the read never
  comes before it.
- **Whose lines.** A checkpoint holds what changed in the workspace during
  the run. A thread that hands its work to a Cell in the same workspace
  (Aski's) lands with that Cell's changes in its own checkpoint, the same
  numbers upstream's changed-files card shows for the turn.

## The moment

- When a turn lands, a `+` rises at the shoulder if the run added lines and
  a `−` if it removed any. They rise over whatever cheer plays, the flex
  included. A run that changed no files shows neither.
- While it edits, the pencil scribbles as before.
- The marks stand stacked at the right shoulder, `+` over `−`, so they
  stay clear of what a Cell wears on its head. They rise in screen
  space, so they don't ride the hop: six hero rows over the cheer's first
  frames, a beat held at the top, then gone. Each time the cheer loops they
  rise again. A cheer shorter than the rise loops before they go.
- `+` is in the diff's green and `−` in its red, as upstream's diffs show
  them. On the light frame, the keyline does its usual job.

## Plan

- [x] Rule: `diffOf(projection, runId)` in `upstream/cellWork.ts`, from the
      run's checkpoints, with a contract test over decoded checkpoints.
- [x] Read: the landing read returns the marks beside the strength and the
      flex.
- [x] Art: the marks and their rise in `art/moves/marks.json`; the kit
      reads them, and the cheer of a look `marked` with them draws them.
- [x] Proof in the dev app: a turn that edits a file (adds and removes), one
      that only adds, and one that changes nothing. Dark and light, with
      shots in the pages folder.

## Review

- The marks read on the composer's Cell at 2x, dark and light: a turn
  that changed a line and added one (+2 −1) raised both, one that only
  added a line raised the `+`, one that changed no file raised neither.
  Shots: `cell-diff-marks.png` in the pages folder.
- The cheer's hop lifts the Cell into the rising marks for a frame; the
  flex's right arm passes behind them for a frame or two. The marks draw on
  top, so both still read.
- Marks while the Cell edits, as `cell-life.md` first drew them, would need
  per-edit counts from the server, a seam the fork doesn't have budget for.
