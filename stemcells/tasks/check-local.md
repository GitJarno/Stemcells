# Checks and the nightly on a Mac (2026-10-22)

the person turned GitHub Actions off for Stemcells; merges go on local checks.
The checks and the nightly sync move onto the Mac, lean, as it's busy.

- [x] `stemcells/scripts/check-local <pr|sha>`: the `check` gates on a clean
      worktree of that exact commit, removed after; one at a time (a lock
      in the git folder, so agents queue), `nice`, two test workers; records
      `local-check` on the commit
- [x] One list: `sync-upstream`'s `CHECK`, run as `--gates check` by
      check-local and by `stemcells.yml`
- [x] The merge rule in `stemcells/AGENTS.md` (Landing) and `fork.md`
- [x] Workflows trimmed while off: pull request checks only into `main`;
      scroll-phases in its own workflow, only when the addon, its build or
      its loader changes
- [x] `sync-upstream --nightly` (`--check`, then the one issue) and
      `--issue`, which the sync workflow calls too
- [x] `install-nightly-sync` (opt in, not installed): launchd at 03:00,
      `nightly-sync` goes ahead only on AC power, under the load limit and
      with no other sync; its own clone and copy outside `~/Documents`, so
      the job raises no privacy prompt
- [x] Proof: `check-local` on this pull request records `local-check`
- [ ] the person: opt in to the nightly on one Mac, if wanted

## Review

The nightly can't read the checkout under `~/Documents`: a launchd job is a
new privacy identity there, and its prompt would hold every Documents read
on the Mac. So it keeps a clone in Application Support. With agents keeping
the load around 20 on 14 cores, a 03:00 run will often skip as busy;
`STEMCELLS_SYNC_MAX_LOAD` at install sets the bar.
