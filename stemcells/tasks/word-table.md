# The word table (2026-11-10)

Stemcells says Cell where upstream says thread, Subcell for subagent or
agent, Flying for Working. Each of those was an edit inside one of
upstream's files, and two of upstream's tests were edited to expect them.
Every such line can conflict on any sync. The app's name had the same
problem and left the sources for a build-time transform keyed on content
(`stemcells/docs/fork.md`, The name transform). This moves the vocabulary
onto it.

## Plan

- [x] `stemcells/brand/wordTable.ts`: entries of a file, upstream's exact
      words on one line, the part of them that changes, ours, and how many
      times the file says them. Our words come from `stemcells/words/`
      (`SUBCELL`, `CASUAL_CHAT`, `COPY_CELL`, and a new `cells.ts` for Cell
      and Flying).
- [x] The name transform applies it (`transformSource` in
      `nameTransform.ts`): the same `transform` hook in the web's, the
      server's and the desktop's builds, and the phone's Metro transformer.
      One source map carries both.
- [x] It can't drift silently. Every build checks every entry against the
      sources before it transforms anything, and each file again as it is
      bundled: words said fewer or more times than the entry says, a file
      that is gone, or two entries on the same words fail the build, naming
      the file and the words. The table refuses a key that spans lines, a
      file no build transforms, and ours that is code.
- [x] The phone's Metro cache key reads the transform's files from their
      own import lines, so a file the table starts reading is in it
      without being listed.
- [ ] Word-only files are upstream's again, byte for byte.
- [ ] Seam files that were mostly words lose their word hunks.
- [ ] Upstream's two tests edited for our words are upstream's again, and
      off `stemcells/edited-tests.txt`.
- [ ] Our contract tests read what a build makes of upstream's source.
- [ ] `seams.md`, `fork.md`, `AGENTS.md`.
- [ ] A web build and a server build pass; the web bundle says our words.

## Review

To come.
