# Taking upstream's work: the runbook

How Stemcells takes T3 Code's work, step by step, for a person or a Cell.
Why it works this way is in `fork.md`; this is what to type.

Every night `.github/workflows/stemcells-sync.yml` runs the same three
commands you run by hand. When a night goes through, a pull request "Take
upstream at <sha> (N commits)" waits for its merge. When it stops, the issue
"Upstream sync needs a hand" says where, and this page says what to do.

| Command | What it does |
|---|---|
| `stemcells/scripts/sync-upstream` | Merges upstream's newest commit whose own CI passed into `sync/upstream-<sha>`, a branch from `origin/main`. Conflicts in upstream's tests resolve themselves. Exits 3 on anything else, printing each file with the seams it touches |
| `stemcells/scripts/sync-upstream --gates [G…]` | Runs the gates on this tree: all of them, or only the ones named |
| `stemcells/scripts/sync-upstream --pr` | Pushes this branch and opens its pull request, or refreshes it, with the report as its body |
| `stemcells/scripts/sync-upstream --report` | Prints the report: commits by kind, seams upstream touched, conflicts, new dependencies, outbound hosts, the test count |
| `stemcells/scripts/sync-upstream --check` | All of it in one go: merge, gates, pull request |

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
   | `lint` | Upstream's lint rules, which hold our code too | Follow the rule as upstream does in its own code; no disable comments |
   | `ours` | Our tests and contract tests, each app's with its own config | A contract test names the upstream behaviour that moved: follow it in the adapter, the seam or the substitute, then in the test |
   | `upstream-packages`, `upstream-web`, `upstream-server` | Upstream's own suites, as its CI splits them, on our tree | Mostly a test pinning a name our seam changes: give it our expectation as a seam row ("Expects …"). Upstream's suites need Node 24 (its `engines`); a Mac's Node 25 fails a few of its tests on `localStorage`. On a busy Mac some time out at 15 s: run the file alone before reading a timeout as a break |
   | `build` | The web, server and desktop builds, and upstream's preload check | |
   | `boot` | The built server starts on a scratch home, and in headless Chromium its page wears Stemcells' look, a chat opens on its composer, and nothing is asked of any host but the server (`stemcells/scripts/boot-smoke.mjs`) | Run it alone after `--gates build`; it prints what the server said and saves the page as it was |
   | `workflows` | Upstream's workflows stay switched off on this repository | `stemcells.yml` switches them off on `main` and on pull requests; switch one off by hand in Actions if it's on |

   The nightly runs every gate on Linux, which is the authority for
   upstream's suites. To run them in CI on any branch:
   `gh workflow run stemcells-sync.yml --ref <branch> -f gates=true`.

5. **Pull request.** `stemcells/scripts/sync-upstream --pr`. Add how many
   minutes resolving took (`fork.md`, rule 7), and anything upstream shipped
   that we should adopt into our layer.

6. **Merge it with a merge commit** (`gh pr merge --merge`), never squash or
   rebase, then remove your worktree. The nightly closes the issue the next
   time it goes through.

## The nightly

- It runs at 03:00 UTC, and by hand from Actions ("Stemcells upstream
  sync", Run workflow).
- Upstream changes its own workflow files often, and Actions' own token may
  not push a commit that does. The nightly uses the repository secret
  `STEMCELLS_SYNC_TOKEN` when there is one: a fine-grained token for this
  repository only, with read and write on Contents, Pull requests, Issues and
  Workflows. Without it, a night whose merge changes a workflow ends after
  its gates with "GitHub refused the push" (exit 5); run
  `stemcells/scripts/sync-upstream --check` on a Mac, where gh's credential
  may push it.
- A pull request opened with Actions' own token runs no checks of its own;
  the gates already ran on its tree, and its body says where.
- It keeps one issue: opened or rewritten each night it stops (with the
  files, their seams and the failing gates' last lines), closed the night a
  sync goes through or finds nothing new.

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
