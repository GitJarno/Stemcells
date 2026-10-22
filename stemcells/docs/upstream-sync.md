# Taking upstream's work: the runbook

How Stemcells takes T3 Code's work, step by step, for a person or a Cell.
Why it works this way is in `fork.md`; this is what to type.

Every night a Mac that opted in (`stemcells/scripts/install-nightly-sync`)
runs the same commands you run by hand. GitHub Actions is off for
Stemcells, so nothing runs them in the cloud. When a night goes through, a
pull request "Take upstream at <sha> (N commits)" waits for its merge. When
it stops, the issue "Upstream sync needs a hand" says where, and this page
says what to do.

| Command | What it does |
|---|---|
| `stemcells/scripts/sync-upstream` | Merges upstream's newest commit whose own CI passed into `sync/upstream-<sha>`, a branch from `origin/main`. Conflicts in upstream's tests resolve themselves. Exits 3 on anything else, printing each file with the seams it touches |
| `stemcells/scripts/sync-upstream --gates [G…]` | Runs the gates on this tree: all of them, or only the ones named |
| `stemcells/scripts/sync-upstream --pr` | Pushes this branch and opens its pull request, or refreshes it, with the report as its body |
| `stemcells/scripts/sync-upstream --report` | Prints the report: commits by kind, seams upstream touched, conflicts, new dependencies, outbound hosts, the test count |
| `stemcells/scripts/sync-upstream --check` | All of it in one go: merge, gates, pull request |
| `stemcells/scripts/sync-upstream --nightly` | `--check`, then the issue kept up to date: rewritten when it stops, closed when it goes through or finds nothing new |
| `stemcells/scripts/check-local <pull request>` | The `check` gates on a clean checkout of the pull request's head, recorded on it as `local-check`, which a merge needs (`stemcells/AGENTS.md`, Landing) |

On a busy Mac, `VITEST_MAX_WORKERS=2` before any of them keeps tests from
timing out under the load; `check-local` and the nightly set it themselves.

## When the nightly stops

1. **A worktree of your own.** Never the main checkout; the script refuses it.

   ```sh
   git fetch -q origin && git worktree add --detach ../Stemcells-wt/upstream-sync origin/main
   cd ../Stemcells-wt/upstream-sync && pnpm install --frozen-lockfile --prefer-offline
   ```

2. **Merge.** `stemcells/scripts/sync-upstream`. It merges on
   `sync/upstream-<sha>` and resolves conflicts in upstream's test files by
   itself (`stemcells/scripts/resolve-test-seams.mjs`): our only edits there
   are expectations that pin a name our seams change, so it takes upstream's
   file and puts each of our line swaps back where upstream still has the
   line. A test upstream deleted, or rewrote past our edits, leaves
   `seams.md` with it. What's left is printed with its seams.

3. **Resolve what's left.** Upstream's logic wins, and our seam goes back on
   top:
   - Take upstream's side (`git checkout --theirs <file>`), then make the
     edit the file's row in `seams.md` describes, and no more.
   - When upstream moved the code a seam edits (split a file, renamed a
     function), the seam moves with it: edit the new file, rename the file in
     its `seams.md` row, and point the contract tests that read the old file
     at the new one.
   - When upstream stopped exporting something our adapter reads, add the
     one-word `export` back as a seam with a row, or read it another way.
   - Never rebase or squash: `git add` the files and `git commit` keeps the
     merge.

   A seam that conflicts twice is a signal (`fork.md`, rule 7): move it into
   our files, a substitute, or an extension point upstream can take.

4. **Gates.** `stemcells/scripts/sync-upstream --gates`. When one fails:

   | Gate | It checks | When it fails |
   |---|---|---|
   | `drift` | Every upstream file we change has a `seams.md` row, and every row's file still differs from upstream | `DRIFT`: add the row, or undo the edit. `STALE`: drop the file from its row |
   | `outbound` | Nothing reports on the person: every host the shipped code names, and every file naming an install or anonymous id, an update feed or a crash reporter, is in `stemcells/outbound.txt` with why; no analytics, crash-reporting or tracing package | Read what the new code does with it. If it reports on the person or phones T3 (analytics, crash reports, update feeds, install ids), turn it off with a seam (`seams.md`, No telemetry). If not (a provider's API, a doc link), add a line to `outbound.txt` saying why. A line the code no longer needs goes |
   | `typecheck` | Every package's types | Usually inside `stemcells/upstream/`, our one place that imports upstream: fix the adapter |
   | `lint` | Upstream's lint rules, which hold our code too | Follow the rule as upstream does in its own code. A disable comment only where upstream would use one too: nothing can mark the moment, and the comment says why |
   | `ours` | Our tests and contract tests, each app's with its own config | A contract test names the upstream behaviour that moved: follow it in the adapter, the seam or the substitute, then in the test |
   | `upstream-packages`, `upstream-web`, `upstream-server` | Upstream's own suites, as its CI splits them, on our tree | Mostly a test pinning a name our seam changes: give it our expectation as a seam row ("Expects …"). Upstream's suites need Node 24 (its `engines`); a Mac's Node 25 fails a few of its tests on `localStorage`. On a busy Mac some time out at 15 s: run with `VITEST_MAX_WORKERS=2`, or the file alone, before reading a timeout as a break |
   | `build` | The web, server and desktop builds, and upstream's preload check | |
   | `boot` | The built server starts on a scratch home, and in headless Chromium its page wears Stemcells' look, a chat opens on its composer, and nothing is asked of any host but the server (`stemcells/scripts/boot-smoke.mjs`) | Run it alone after `--gates build`; it prints what the server said and saves the page as it was |
   | `workflows` | Upstream's workflows stay switched off on this repository | `stemcells.yml` switches them off on `main` and on pull requests; switch one off by hand in Actions if it's on |

   Upstream's own CI runs its suites on Linux. On a Mac, the gates leave
   out the one test that needs a case-sensitive disk, and run the preload
   check as Linux would.

5. **Pull request.** `stemcells/scripts/sync-upstream --pr`. Add how many
   minutes resolving took (`fork.md`, rule 7), and anything upstream shipped
   that we should adopt into our layer. While it waits, main moves: merge
   it in (`git merge origin/main`, never a rebase) and run the gates again.
   Main's newest work meets upstream's new rules and moved files for the
   first time here, and a pull request's own checks run on it merged with
   main.

6. **Merge it with a merge commit** (`gh pr merge --merge`), never squash or
   rebase, once its head carries `local-check` = success
   (`stemcells/scripts/check-local <pull request>`). Then remove your
   worktree. The nightly closes the issue the next time it goes through.

## The nightly

- Opt in on one Mac: `stemcells/scripts/install-nightly-sync` (with Node 24
  first on PATH). It installs a launchd job, `sh.stemcells.nightly-sync`,
  that runs `nightly-sync` at 03:00. `--print` shows the job without
  installing it, and `--remove` takes it away.
- `nightly-sync` goes ahead only on AC power, when the load average is
  under the Mac's number of cores (`STEMCELLS_SYNC_MAX_LOAD` at install
  sets another), and when no other `sync-upstream` runs. Then, at low
  priority, `sync-upstream --nightly` runs in a fresh worktree of a clone
  of its own. `nightly-sync --dry-run` says whether a run now would go
  ahead. It logs to `~/Library/Logs/stemcells-nightly-sync.log`.
- The job never reads the checkout you work in. That checkout sits under
  `~/Documents`, and a launchd job reading there raises a privacy prompt
  that holds every Documents read on the Mac until someone answers it. The
  script and its clone live in
  `~/Library/Application Support/sh.stemcells.nightly-sync`.
- It pushes with gh's credential, which may push upstream's workflow-file
  changes.
- It keeps one issue: opened or rewritten each night it stops (with the
  files, their seams and the failing gates' last lines), closed the night a
  sync goes through or finds nothing new.
- `.github/workflows/stemcells-sync.yml` does the same on Linux if Actions
  is ever switched back on. It needs the repository secret
  `STEMCELLS_SYNC_TOKEN` to push upstream's workflow changes: a
  fine-grained token for this repository only, with read and write on
  Contents, Pull requests, Issues and Workflows.

## What never happens

- Nothing is posted to upstream's repository. The only call to it reads its
  CI results, to pick a green commit.
- Nothing reports on the person, to T3 or anyone else: the `outbound` gate,
  `seams.md` (No telemetry).
- Upstream's workflows never run here.
- Upstream's history is never rebased or squashed.

## Notes from syncs

- 2026-10-21 (136 commits): upstream deleted about 11,000 low-value tests and
  rewrote the rest under new lint rules. Every conflict of the failed night
  was in a test where our seam pinned a name, which is why tests now resolve
  themselves. Its Vitest turned on an on-disk transform cache that doesn't
  know a substitute resolves a module by who imports it, so the web's and
  the phone's test configs turn it off (`seams.md`).
