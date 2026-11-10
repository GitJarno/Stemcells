# The seams' rows, a file per part of the repository

`stemcells/seams.md` held every seam's row in one table of about 200
padded lines. Every pull request with a seam added a line to it, so our
own parallel pull requests met there, and a cell longer than its column
made the formatter pad every row again.

## What

- [x] The rows live in `stemcells/seams/`: `web.md`, `server.md`,
      `mobile.md`, `desktop.md`, `packages.md` and `rest.md`. A row goes in
      the file its first path belongs to.
- [x] Rows stand in path order, each on one line with no padding, inside a
      formatter-ignore block: a new row changes no other line.
- [x] `seams.md` is the index. Its families, Known overlaps and Hot-file
      budget stay where they were, so "`seams.md`, <section>" still holds.
- [x] `drift` reads `seams.md` and `seams/*.md`. DRIFT names the file a
      missing row goes in; STALE names the file a stale row is in.
- [x] The other readers follow: `sync-upstream`'s report,
      `resolve-test-seams.mjs` (it drops a row from whichever file names
      the test) and the lab's `launches.test.ts`.
- [x] A boundary test for our folder at the repository's root:
      `stemcells/boundary/boundary.test.ts`, with the shared check.

## Decisions

- **Where the collisions were.** Five pull requests in a row (#100, #103,
  #104, #109, #111) each added a row on the same few lines, for the web's
  `tsconfig.json`. One landed change re-padded the whole table (#65, 192
  lines); the rest avoided that by padding a row by hand and never running
  the formatter on the file. A file per part cuts the first; no padding
  ends the second.
- **Path order, not the order rows arrived in.** With an order, a row has
  one line it belongs on, and two pull requests meet only when they add
  beside the same row. Nothing enforces it: a row out of order still works.
- **`drift` still takes a file named anywhere in `seams.md`.** Six of
  upstream's tests are named only in a paragraph there (The app's name),
  with no row; `stemcells/edited-tests.txt` holds each to a reason.
- **One row was dropped:** a Hot-file budget row for the phone's
  `ThreadComposer.tsx` that a sync had left in the registry. The file keeps
  its seam row and its budget row.
- **The sections still say "the seam above".** One sentence in the index
  says it means a row in those files, rather than an edit to twenty-odd
  sections that open pull requests also touch.
- **The root boundary has one known reach,** pinned in the test with why:
  `brand/releaseNames.test.ts` imports upstream's
  `scripts/build-desktop-artifact.ts`, whose seams it pins. No app's folder
  of ours holds that script, so the test has no adapter to go through.
  Left where it is.

## A branch that carries a row

After this lands, a branch that added or edited a row in `seams.md`'s
table conflicts there when it takes `main`. Keep `main`'s side of the
file, then put the row in its `stemcells/seams/` file, on one line, where
its first path sorts. `stemcells/scripts/drift` names the file when a row
is missing.

## Review

- `drift` and `drift --summary` print the same totals with the split as
  without it, and no DRIFT or STALE line.
- On the real tree, a row taken out of `seams/web.md` makes DRIFT name
  that file, and a row added for a file that is upstream's makes STALE
  name the file it was added to.
- The rows moved are the rows that were: compared cell by cell, but for
  the one dropped.
- Still colliding: the web's `tsconfig.json` itself. Every feature that
  shares root code with the web adds an `include` line there, and a row
  for it. A glob in that `include` would end both; not done here.
