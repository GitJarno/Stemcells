# Disk: every machine, and a cleanup list you answer with IDs

Settings › Disk shows this machine's free space and opens a cleanup Cell.
Two gaps: the Cell's list is numbered with Safe/Careful verdicts, so a
reply can't say how much risk it accepts, and only this machine shows,
though Cells run on others too.

## Plan

- [x] The cleanup Cell's list in three tiers, Low, Medium and High, each
      item an ID (L1, M2, H1) the person answers with ("delete L1, L3 and
      M5", "all L"). High is the person's own data and anything that may be
      the only copy, listed by name and size only, never opened.
- [x] Fixes from the original app's benchmark: Trash is Medium (emptying it is
      for good); Downloads no longer contradicts the report (installers M,
      the rest H); local snapshots and purgeable space named; space that
      came back measured with `df` before and after, since `du` overstates
      APFS clones.
- [x] Settings › Disk's badges say Low and Medium risk, the tiers the Cell
      answers in.
- [x] Every connected machine's free space: upstream's
      `server.getHostResources` carries the home volume's total and free
      bytes (optional fields, so older servers still answer), a seam.
- [x] "Free space" on another machine opens the Cell in a project on that
      machine, with the ask alone (no measurement from this one); this
      machine's opens in a project here, not the sidebar's first project,
      which may be elsewhere.

## Review

Merged as #221; `check-local` passed every gate. An independent review
found the ask sending the Cell into folders the walk avoids (Mail,
Messages, Photos, other volumes) and `statfs` without a timeout on the RPC
upstream's load balancing reads: both fixed. The seam stays ours: we don't
offer T3 the fields (`fork.md`, rule 5), so an SSH machine, which runs
T3's released server, shows its free space as unknown. Not run in a real
client.
