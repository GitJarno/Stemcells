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
  the run. Aski's thread can hand work to a Cell and land before that Cell
  has edited anything; its checkpoint then holds no files. So the marks
  rise on the Cell that made the edits, and on Aski's only for what changed
  while its own run was going. (#94 said a delegating thread always carries
  its Cell's changes. A later proof showed it doesn't.)

## The moment

- When a turn lands, a `+` rises at the shoulder if the run added lines and
  a `−` if it removed any. They rise over whatever cheer plays, the flex
  included. A run that changed no files shows neither.
- While it edits, the pencil scribbles as before.
- Small and brief. The marks are the smallest a `+` can be drawn: three
  hero cells, with a `−` of three under it. They stand in the box's
  top-right corner, clear of most hats.
- They rise once a landing, four hero rows in a third of a second, and hold
  there for two thirds more, then they're gone: a second in all, on the
  sprite clock from the moment the Cell first draws them. The diff is read
  a moment after the landing, so the count starts then. The cheer's frames
  don't move them; they are drawn over the frame, on the box
  (`cell/marks.ts`). Reduce Motion holds them at the top while the Cell
  cheers.
- #94 drew them into the cheer's own frames instead. The cheer loops for
  six seconds, so they rose about four times.
- `+` is in the diff's green and `−` in its red, as upstream's diffs show
  them, on either frame.

## Plan

- [x] Rule: `diffOf(projection, runId)` in `upstream/cellWork.ts`, from the
      run's checkpoints, with a contract test over decoded checkpoints.
- [x] Read: the landing read returns the marks beside the strength and the
      flex.
- [x] Art: the marks and their rise in `art/moves/marks.json`, read by the
      kit.
- [x] Brief: drawn over the frame from the box, once a landing
      (`cell/marks.ts`), and smaller, in the corner.
- [x] Proof in the dev app: a turn that edits a file (adds and removes), one
      that only adds, and one that changes nothing. Dark and light, with
      shots in the pages folder.

## Review

- The marks read on the composer's Cell at 2x, dark and light: a turn
  that changed a line and added one (+2 −1) raised both, one that only
  added a line raised the `+`, one that changed no file raised neither.
  Shots: `cell-diff-marks.png` in the pages folder.
- The flex's right arm, and a wide hat's brim in the hop, pass behind the
  marks for a beat. The marks draw on top, so both still read.
- Brief, in the dev app: on a Cell that made the edits, the marks rose and
  were gone within about a second of the landing, then stayed gone for the
  rest of the cheer. They rose for +2 −1 (dark) and only the `+` for +1
  (light); a turn that changed nothing raised neither (dark). Shots:
  `cell-diff-marks-brief.png` in the pages folder.
- Marks while the Cell edits, as `cell-life.md` first drew them, would need
  per-edit counts from the server, a seam the fork doesn't have budget for.
