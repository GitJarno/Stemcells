# Upstream sync as a standard process (2026-10-21)

the person: take what T3 shipped since we forked, check the test slimming, and
make the sync scalable and safe for our layer, with no telemetry to T3.
Runbook: `stemcells/docs/upstream-sync.md`.

- [x] Why the nightly of 2026-10-21 failed: every one of its 9 conflicts was
      a test where our seam pins a name; upstream had deleted ~11k tests and
      rewritten the rest (#22557 and second passes)
- [x] Root cause fixed: `resolve-test-seams.mjs` resolves test-only
      conflicts in the sync (replayed: all 9 of that night resolve), and
      drops their `seams.md` entries; `drift` fails on a stale row
- [x] Merge upstream at 680152e27 (136 commits), seams moved with the split
      files, contract tests follow them; main merged in
- [x] Outbound guard: `stemcells/outbound.txt` allowlist, checked in
      `privacy/noTelemetry.test.ts` (hosts, ids/feeds/crash reporters,
      analytics packages)
- [x] Vitest 5's on-disk transform cache broke our substitutes on warm runs:
      off for web and mobile
- [x] Our tests under upstream's new test lint rules; our hooks under its
      React Compiler coverage
- [x] `sync-upstream`: merge / `--gates` / `--pr` / `--report`, the same
      gates on a Mac, in PR CI (the quick ones) and in the nightly
- [x] Nightly keeps one issue; headless boot smoke; upstream workflows off on
      PRs too
- [x] The gates in CI run upstream's suites as its CI does: libsecret and a
      C toolchain installed, and the job's GitHub token kept out of them (its
      source-control tests took it for a signed-in account)
- [ ] The nightly needs `STEMCELLS_SYNC_TOKEN` to push upstream's workflow
      changes (the person)

## Review

The failed night was not bad luck: our seams in upstream's test files are
the most-conflicting kind, and upstream rewrites its tests more than
anything. They now resolve themselves, and the gates (upstream's suites on
our tree) catch a swap put back wrongly. The two remaining risks are the
token for workflow pushes and toolchain changes like Vitest's cache, which
only a full gate run on the merged tree finds.
