# Installing from inside Stemcells, and a check that builds

Two things stood between `main` and an installed app.

## Why

- `check-local` passed #227 and #230, and both broke the app's build: their
  words said "T3 Code" where the name check refuses it, and that check runs
  only in a build. The `check` gates never built. `install-app` failed on
  `main` until #232 fixed the words.
- `install-app` quits the Stemcells it replaces. Run from a Cell or the
  app's terminal, as `install.md` tells agents to, quitting the app ends
  the script with it, halfway through the swap. Quitting also ends a
  `check-local` run in progress, so whoever started it has to wait in the
  queue again.

## Plan

- [x] `check` runs the `build` gate too (`sync-upstream`'s `CHECK`).
- [x] `install-app` notices it runs inside the app it replaces (an ancestor
      process is that app's executable), and hands the quit, swap and open
      to a run of its own. Two forks and a new session put that run outside
      the app's process tree. A notification says how it went.
- [x] The swap takes `check-local`'s lock before quitting the app, waiting
      half an hour at most. A run in progress finishes, none starts during
      the swap, and two swaps never overlap.
- [x] The new copy goes in beside the old one before the old one moves, so
      a copy that fails on a full disk leaves the old app in place.
- [x] The script prints the detached run's pid, to call it off with `kill`.
- [x] `--to` is resolved to its real path, as `ps` shows the app's.
- [x] `install.md` says so, for people and for agents.

## Review

- The detach: a starter in its own process group double-forked a child,
  then the starter's group was ended. The child had launchd as its parent,
  survived and finished its work.
- The detection, against an ancestor whose argv[0] is a fake app's
  executable (how Electron shows itself in `ps`): inside=1. From a plain
  shell: inside=0. From this Cell, against `/Applications/Stemcells.app`:
  inside=1.
- Stemcells answers an Apple Event sent from inside it, so the quit the
  detached run sends gets through.
- The build gate: `pnpm build:desktop` failed at `9427aa987` (before #232)
  with the name check's error, the same command `gate_build` runs.
- The swap, in a scratch repository with stand-ins for `open` and
  `osascript` and a scratch home:
  - a stale lock was taken over and the swap went through, leaving nothing
    behind;
  - a copy that failed left the old app in place and the lock free, and
    posted "Not updated";
  - a live lock holder was waited out, then the swap went through.
- The detached run printed its own pid at once, with launchd as its parent.
- An independent review found the gaps above (a copy failing with the old
  app already gone, a lock checked but not taken, an endless wait, a
  non-canonical `--to`). All four are fixed.
- `check-local` on this pull request ran the new build gate (14 s) and
  passed.
- The end-to-end run is the install after the merge, from a Cell. Its
  notification and `$TMPDIR/stemcells-install-app.log` say how it went.
