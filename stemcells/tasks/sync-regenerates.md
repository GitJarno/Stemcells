# A sync regenerates generated files (2026-11-10)

`sync-stats` shows the web's route tree and the agent context budget each
conflicting in three syncs, and the lockfile in one. Each is written by a
tool from the rest of the tree, so merging them by hand is work a sync can
do itself.

- [x] One list in `sync-upstream`, `GENERATED`: the files a generator
      writes, and the function that runs it
  - `pnpm-lock.yaml`: `pnpm install --no-frozen-lockfile`, first, as the
    others run what it installs
  - `apps/web/src/routeTree.gen.ts`: TanStack's generator, with the options
    `vite.config.ts` gives its plugin (`generate-route-tree.mjs`)
  - the phone's four theme files: the mobile package's `generate` script
  - `agentContextBudget.json`: nothing of upstream's writes it; its test
    measures, and a person copied the numbers. `generate-context-budget.mjs`
    runs that test, reads the measured side of its failed assertion through
    a Vitest reporter, writes it and runs the test again
- [x] After the merge (now `--no-commit`, so the merge commit carries
      them): a generated file that conflicted takes upstream's side, then
      every generator runs and what it wrote is staged. Generators read the
      merged tree, so with other conflicts open they wait:
      `sync-upstream --regenerate` after the last one
- [x] A generator that fails stops the sync with exit 6 and its file's name
- [x] The report lists a generated file's conflict as `generated`, not as
      left to resolve by hand
- [x] `upstream-sync.md`, the `t3-sync` skill, `fork.md` and the files'
      `seams.md` rows no longer tell a Cell to resolve them by hand

## How it was checked

- `sync-regenerate.test.ts` replays the sync of 2026-11-08, which conflicted
  in the lockfile, the route tree and the budget, in a scratch repository
  that borrows this one's objects. The route tree's generator is the real
  one there; `pnpm` is stood in for
- Each generator, run on this tree from upstream's copy of its file, wrote
  back exactly what is committed
- The whole of `sync-upstream`, run in a scratch repository with scratch
  remotes and `gh` and `pnpm` stood in for: the clean sync of 2026-10-20
  ended in one merge commit; the sync of 2026-11-08 stopped with exit 3 on
  its 32 other conflicts, and after those were resolved as that sync did,
  `--regenerate` wrote a route tree identical to the one committed then

## Review

The budget file had no generator, which is why it conflicted most: it now
has one of ours. A sync installs right after the merge, as the lockfile's
generator is the install.
