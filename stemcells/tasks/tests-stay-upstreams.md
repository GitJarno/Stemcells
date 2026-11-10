# Upstream's tests stay upstream's (2026-11-10)

34 of upstream's test files were edited. Upstream edits its tests with every
change, so each edit is a conflict waiting: the first measured sync
conflicted only in tests. Eight of them needed no edit at all.

- [x] Our own cases leave upstream's files, which are upstream's again byte
      for byte:
  - the lean call's flags (`ClaudeTextGeneration.test.ts`,
    `CodexTextGeneration.test.ts`) and the event loop's unseen freeze
    (`EventLoopMonitor.test.ts`) are contract tests in the server's own tree,
    `stemcells/upstream/runLean.contract.test.ts` and
    `loopGaps.contract.test.ts`, where the `ours` gate runs them on every
    pull request
  - the checkpoint case (`nodeSqliteClient.test.ts`) is
    `nodeSqliteClient.checkpoint.test.ts` beside it, as `packages/shared`
    has no folder of ours
- [x] `stemcells/upstream-skips.txt`: upstream's tests a change of ours
      breaks, by name, each with why. The three upstream gates pass Vitest
      a `-t` pattern that leaves them out (`skip_pattern` in
      `sync-upstream`), the way a Mac's `agy.CMD` case already was. It
      replaces the four `it.skip` edits in three browser tests
- [x] `maintenanceResolver.test.ts` had not only gained cases: our seam
      breaks three of upstream's (two rows of its registry table, and its
      npm capabilities), which our edit removed or loosened. Restored, with
      the three on the skip list; `maintenanceResolver.npmReleaseAge.test.ts`
      already pins ours
- [x] `stemcells/edited-tests.txt`: the 26 upstream tests still edited, each
      with why. `drift` fails on an edited upstream test it doesn't name, a
      line whose file is upstream's again or has no reason, and a line the
      base doesn't have, so it only shrinks. `drift.test.ts` covers each
- [x] The rule, in `fork.md` (rule 1) and `stemcells/AGENTS.md`
- [ ] Later: the edits that only pin our words leave the list

## How it was checked

- `git diff <merge-base> -- <the eight files>` is empty
- Each moved case fails when its seam is taken out of upstream's module
- Unskipped, the six listed names fail on our tree (seven tests); with the
  pattern, their files pass and exactly those are skipped
- `drift`: 212 files, 3350 lines, 707 hunks before; 205, 3277, 697 after

## Review

The brief asked for our cases beside upstream's files. The server's three
went into its own tree instead: a new file beside upstream's still counts
as drift and runs only in a sync's upstream gates, while a contract test
runs on every pull request. Vitest skips by name only, not by file, so a
skip-list name must be one no other test of upstream's shares.
