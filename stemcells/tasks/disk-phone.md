# Disk on the phone

The web's Settings › Disk shows each connected machine's free space and
starts a cleanup Cell on it, answered with L/M/H IDs. The phone, the remote
control a person carries, has no such page. Same feature there, the same
words, and nothing the phone itself measures: it only reads what each
machine's server reports and opens a Cell on that machine.

## Plan

- [x] One copy of the cleanup ask, and of the size format, shared by the
      server, the web and the phone (`stemcells/words/disk.ts`). The web
      builds another machine's ask itself, so the `?machine=other` route
      goes.
- [x] A cleanup Cell opens in the project folder itself, never a new
      worktree: a worktree on a full disk copies a checkout and runs its
      setup (an install). Web and phone.
- [x] Phone: Settings › Server settings › Disk lists each machine with its
      free space (refreshed every 30 s while the app is in front), and a
      tap opens a new Cell on that machine with the ask waiting, unsent.
      A machine that isn't connected, or has no project, says so.
- [x] Seams: the screen in `Stack.tsx`'s settings stack, the row in
      `SettingsRouteScreen.tsx`, each an import and one line; listed in
      `seams.md`, with a contract test that a draft's own workspace
      choice beats the project's default.
- [x] Checks: typecheck, lint, the tests beside the change, drift,
      check-local; merge.

## Review

Done. Typecheck, lint, drift and the tests beside the change pass;
`seams.md`'s format and knip's unused files fail on `main` too. An
independent review found three things, all fixed: on an iPhone the Cell,
once sent, would have shown inside the Settings sheet (the new Cell now
takes Settings' place); a double tap left a second draft behind; a machine
still connecting read "Not connected". The cleanup ask is byte-identical to
the server's old copy. Not run on a phone or simulator.
