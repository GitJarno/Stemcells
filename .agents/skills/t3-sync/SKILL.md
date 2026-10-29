---
name: t3-sync
description: Take T3 Code's newest green upstream work into Stemcells and adopt it with the least drift. Outbound gate first, then merge, gates, buckets (adopt, retire ours, skip, watch), the sync pull request and one small follow-up per item. Use for /t3-sync or "sync upstream".
argument-hint: "[follow-ups]"
---

# /t3-sync: take T3 Code's work and build on it

Stemcells lives on T3 Code's work: every fix and feature we take instead of
building is one we never maintain. A sync has two jobs. It takes upstream's
commits with the least drift, and it reads them for what we can now adopt, or
delete of ours. Why the fork works this way: `stemcells/docs/fork.md`. The
commands and what each gate checks: `stemcells/docs/upstream-sync.md`. This
skill is the order to run them in, and the judgment around them.

With `follow-ups` as the argument, or when step 1 finds nothing new, go
straight to step 6 for the last sync's adopt and retire-ours items.

## Gate zero: nothing reports on the person

Nothing upstream brings may track the person or contact T3 for them. This gate
runs before any other, and a failure stops the sync. Nothing merges past it.

1. **Static, on every sync.** `stemcells/scripts/sync-upstream --gates outbound`
   must pass. `stemcells/outbound.txt` must list each of these, with a reason:
   every host the shipped code names, every install or device id, update
   feed, crash reporter, remote model or config fetch, and every sign-in to
   T3's services (T3 Connect, Clerk). No analytics, crash-reporting or
   tracing package is allowed at all. The gate only sees literal hosts and
   known names, so also read what it can't see. The report lists upstream's
   new call sites under Outbound; read each one, and the diff around it
   (step 2, **watch**):
   - `fetch`, `WebSocket`, `EventSource`, `net`, `tls`, `http(s).request` and
     `navigator.sendBeacon` call sites;
   - hosts built from variables;
   - analytics SDKs, including ones under new names;
   - ids written to disk;
   - reporting switched on by an environment variable (`*_OTLP_*`,
     `*_TELEMETRY_*`, `*_DSN`).

   Each finding ends one of two ways:
   - **Substituted out** (preferred): a substitute or one-import seam turns
     it off (`seams.md`, No telemetry).
   - **Listed in `outbound.txt`** with a reason the person would accept. "T3's
     own host" is never a reason, unless the person starts the contact
     themselves (opens a link, signs in, browses a registry).

2. **Runtime, on every sync.** `stemcells/scripts/sync-upstream --gates
   outbound-live`, after `build`. It boots the built app in the desktop lab
   with fake CLIs in a scratch home, and no real account. It uses it for a
   few minutes and records every DNS lookup and connection: Chromium's net
   log, the Node processes' lookups and sockets, and `lsof` over the process
   tree. It fails on any host but loopback. Its result goes in the sync
   pull request, first. A failure is a stop: find the code, substitute it
   out, run it again. A contact may stay only as a `live` line in
   `outbound.txt`, with a reason and what removes it: a host, or a host and
   path, so a line for one file on a shared host never lets another
   through. The gate also fails on a `live` line it no longer sees, so that
   list only shrinks.
3. **Defaults.** Nothing that contacts anyone ships switched on unless the
   person starts it. Read new settings and their defaults in the diff. T3's
   update channel and feeds stay off: Stemcells updates only from its own
   source (`stemcells/docs/install.md`).

T3's model list is bundled at build time, never fetched (#206): each sync
brings upstream's newer `model-manifest.json` with it. `outbound.txt`'s
`forbid` lines keep any shipped code from reading T3's repository, and a
file that still names it is listed as `cut`, with why it never fetches.

## Hard rules

- **No telemetry, no contact with T3.** Gate zero, above.
- **Never post to T3's repository.** No pull requests, issues, comments or
  reactions there, and never a push to `upstream`. The only call to it reads
  its CI results, to pick a green commit. An extension point we'd want from
  upstream stays a seam we carry, listed in `stemcells/tasks/seam-debt.md`
  (the person, 2026-10-21).
- **Words a person reads say Cell and Aski** in our layer. Upstream's own
  strings stay until one of our views replaces the view that shows them.
- **Minimal drift.** Take upstream's file; never grow a hot file's seam;
  never edit upstream to fix upstream.
- **Local checks only.** GitHub Actions is off for this repository. A pull
  request merges only when its exact head carries the commit status
  `local-check` = success: `stemcells/scripts/check-local <pr>` records it
  (the `check` gates on a clean checkout of that head, one run at a time,
  niced). A push after it needs a new run. Every gate runs on this Mac, so
  keep the load low: `nice -n 10`, one heavy run at a time, and check
  `uptime` before starting a long one.
- **Merge, never rebase or squash upstream's history.**

## Before you start

- [ ] A worktree of your own (never the main checkout, which the script
      refuses):
      `git fetch -q origin && git worktree add --detach ../Stemcells-wt/upstream-sync-<date> origin/main`,
      then `pnpm install --frozen-lockfile --prefer-offline` inside it.
- [ ] `df -h /`: a build and the gates need about 3 GB. Clean other
      worktrees' `.vite`, `.t3`, `dist` and lab folders you made, never
      someone else's.
- [ ] `gh pr list --search "Take upstream at" --state open`: no other sync
      is open. If one is, it owns the sync, and you do follow-ups only. An
      open issue "Upstream sync needs a hand" is the nightly saying where it
      stopped: take its branch from step 3.

The nightly is opt-in: `stemcells/scripts/install-nightly-sync` installs a
launchd job that runs `sync-upstream --nightly` at 03:00, in a clone of its
own. It skips the night when the Mac is on battery or busy (load over its
cores, or `STEMCELLS_SYNC_MAX_LOAD`), or another sync runs;
`stemcells/scripts/nightly-sync --dry-run` says whether a run now would go.
It does steps 1, 4 and 5's report; the reading (step 2), the resolving
(step 3) and the follow-ups (step 6) are this skill's.

## 1. Pick the target and merge

- [ ] `stemcells/scripts/sync-upstream`. It picks upstream's newest commit on
      which upstream's own CI passed (never the tip blindly) and merges it on
      `sync/upstream-<sha>`. Conflicts in upstream's tests resolve themselves
      (`resolve-test-seams.mjs`).
  - Exit 0 with "already has": nothing new. Go to step 6.
  - Exit 3: conflicts remain. Note the time, and go to step 3.
- [ ] `pnpm install --frozen-lockfile` when the lockfile moved.

## 2. Read what changed, like a staff engineer

`stemcells/scripts/sync-upstream --report` lists every commit with its pull
request number, the seams upstream touched, new dependencies and outbound
hosts. Read each commit's title, and the diff wherever the title leaves the
effect on us open. Sort each one into a bucket:

| Bucket                   | What goes in it                                                                                             | What you do                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Comes free**           | Fixes and features that just work through our layer                                                         | Nothing. Name the notable ones in the report                                                      |
| **Adopt**                | Upstream features that one of our substitutes or seams hides or restyles, so a person doesn't get them yet  | One follow-up each: wire it into our surfaces, in our look and words                              |
| **Retire ours**          | Our features or code that upstream now covers                                                               | The main lever. Switch to theirs and delete ours, after the person sees the difference (step 6)   |
| **New extension points** | Upstream hooks, slots, exports, settings or registries that would let a seam become a substitute, or vanish | A follow-up that deletes the seam. Check `seam-debt.md`: one we've been carrying may have arrived |
| **Touches our seams**    | Files split, renamed, moved or un-exported where our seams are                                              | Port the seam in the sync itself (step 3)                                                         |
| **Skip**                 | Release infrastructure, T3 Connect and Clerk sign-in, marketing, upstream's dev tooling                     | Nothing                                                                                           |
| **Watch**                | Telemetry and network: a new host, id, feed, fetch, socket or reporting switch                              | Gate zero. Any new contact is a stop until it is substituted out or listed                        |

How to find each:

- **Touches our seams:** the report's "Seams upstream touched", and
  `git diff --stat <before> <target>` against the files in `stemcells/seams.md`.
- **Adopt and comes free:** for each `feat` or `fix` touching `apps/web`,
  `apps/mobile` or `apps/desktop`, grep our layer for the module it
  changed: `git grep -l <module> -- 'apps/*/src/stemcells'` and
  `apps/web/src/stemcells/upstream/substitutes/plugin.ts`. A hit means our
  layer might hide the change. Check it in the lab.
- **Retire ours:** for each upstream feature, ask whether we have one like
  it: `stemcells/tasks/*.md`, `seams.md`'s sections, and its "To offer
  upstream" lines. A setting, banner, keybinding or view we built that
  upstream now ships is a candidate.
- **New extension points:** new exports and registries in
  `packages/contracts`, `packages/client-runtime`, settings schemas,
  provider `launchArgs`, MCP tools and keybinding config. Then ask: which
  seam would this let us delete?
- **Watch:** added lines in shipped code that open a connection or name an
  id:

  ```sh
  git diff -U0 <before> <target> -- apps/server/src apps/web/src apps/desktop/src \
    apps/mobile/src packages ':!*.test.*' ':!**/test/**' |
    grep -E '^\+' | grep -E 'fetch\(|WebSocket|EventSource|sendBeacon|net\.(connect|createConnection)|tls\.connect|https?\.(get|request)|autoUpdater|setFeedURL|crashReporter|process\.env\.[A-Z0-9_]*(OTLP|TELEMETRY|ANALYTICS|SENTRY|POSTHOG|DSN|TRACE)|anonymous|installId|machineId|deviceId'
  ```

## 3. Resolve conflicts

Time it: the pull request says how many minutes resolving took
(`fork.md`, rule 7).

- [ ] **Take upstream's file** (`git checkout --theirs <file>`), then put ours
      back the smallest way:
  - a substitute, when the edit only swaps a module or wraps an export;
  - else a one-import seam: one import, one line that hands control to
    `stemcells/`.

  The file's row in `seams.md` says what our edit was. Make that edit, and
  no more.

- [ ] **When upstream moved the code** (split a file, renamed a function,
      stopped exporting a name), the seam moves with it. Edit the new file,
      rename it in its `seams.md` row, and point contract tests at the new
      place. Prefer a substitute of the new, smaller module over an edit in
      the old, hot one.
- [ ] **Never grow a hot file's seam.** `drift` holds each hot file to its
      row in `seams.md`'s Hot-file budget. If the port needs more lines
      there, move the logic into our folder instead.
- [ ] **Never edit upstream to fix upstream.** An upstream bug we hit gets
      a seam with a row that names it, or waits for their fix. No silent
      patches.
- [ ] `git add` the files and `git commit` (keeps the merge; never rebase).
- [ ] A seam that conflicted twice (`stemcells/scripts/sync-stats`) goes on
      the follow-up list: substitute it, or make it an extension point we
      carry.

## 4. Gates

Run them niced, one heavy run at a time, in this order:

- [ ] `outbound`: gate zero, static.
- [ ] `drift`, then `stemcells/scripts/drift --summary --base origin/main`
      for the report's before-and-after table (where drift has no
      `--summary` yet, `drift` alone and its totals line).
- [ ] `typecheck`, `lint`, `ours` (our tests and contract tests).
- [ ] `upstream-packages`, `upstream-web`, `upstream-server`: upstream's own
      suites on our tree. A 15 s timeout under load is run again alone
      before it counts as a break. They want the Node upstream's `engines`
      names (26.12.1 since 2026-10-21), first on PATH; the gates say when
      another one runs.
- [ ] `build`, `boot`, then `outbound-live`: gate zero, at runtime.
- [ ] All at once: `nice -n 10 stemcells/scripts/sync-upstream --gates`.
      A sync runs every gate; `check` is only the quick list.
- [ ] Once the pull request is open: `stemcells/scripts/check-local <pr>`
      on its head, the merge gate (`local-check`).

A red contract test names the upstream behaviour that moved: follow it in
the adapter, the seam or the substitute, then in the test.

## 5. The pull request

- [ ] `stemcells/scripts/sync-upstream --pr` pushes and opens the pull
      request "Take upstream at <sha> (N commits)", with the generated report
      as its body.
- [ ] Edit the body (`gh pr edit <n> --body-file <file>`) so it opens with
      what a reader needs, in this order:

  ```markdown
  ## Outbound

  Static gate: passed / what was found, and how each was substituted out or listed.
  Runtime (outbound-live): hosts seen: loopback only / the list. Minutes run.
  Defaults: anything new that contacts anyone, and that it is off.

  ## In short

  What this takes, how many commits, and anything that needs the person.

  ## What upstream shipped, for us

  |                          |                                                           |
  | ------------------------ | --------------------------------------------------------- |
  | **Comes free**           | …                                                         |
  | **Adopt**                | … (each becomes a follow-up)                              |
  | **Retire ours**          | … (each listed for the person before anything is deleted) |
  | **New extension points** | …                                                         |
  | **Touches our seams**    | … (ported here)                                           |
  | **Skip**                 | …                                                         |
  | **Watch**                | …                                                         |

  ## Drift

  The drift --summary table, before and after, and the seams this sync added, moved or deleted.

  ## Conflicts

  Each file, which seam it held, and how it was resolved (theirs plus the seam / moved / substitute). Resolving took N minutes.

  ## Gates

  Each gate, passed or failed, with the head it ran on and the Node version.

  ## Follow-ups

  - [ ] adopt: … (#PR)
  - [ ] retire ours: … (listed for the person)

  ## Needs the person

  Only what only he can decide.
  ```

  The generated report (commits by kind, seams touched, new dependencies,
  tests) stays below.

- [ ] While it waits, main moves: `git merge origin/main` (never a rebase),
      then the gates again. Main's newest work meets upstream's new rules
      here first.
- [ ] Merge with a merge commit, `gh pr merge <n> --merge`, once every gate
      passed and `local-check` is green on its exact head. Never squash or
      rebase. If whoever started you merges, report the head and the gate
      results instead.
- [ ] Right after the merge, `stemcells/scripts/sync-upstream --workflows-off`:
      GitHub starts a workflow new to `main` switched on.

## 6. Follow-ups

One small pull request per **adopt**, **retire ours** and **new extension
point** item. Each gets a worktree from `origin/main` once the sync has
merged, `sync-upstream --gates check` before each push, and
`stemcells/scripts/check-local <pr>` on its head (`local-check`).

- **Prefer deleting our code to adding it.** A follow-up that adds lines to
  adopt something says why no smaller route exists.
- **Adopt:** wire upstream's feature into our surfaces, in our look
  (`stemcells/brand/look.ts`, our CSS layer; tokens by role) and our words.
  Through a substitute or our own folder first; a seam only when nothing
  else reaches.
- **Retire ours:** before deleting, list each candidate for the person: what
  ours does, what upstream's does, how the look and behaviour change (lab
  screenshots, before and after), and the drift it removes. The person cares
  about the look. Delete only after his yes. Plain adoptions go ahead
  without asking.
- **Visual proof** comes from the desktop lab only:
  `stemcells/lab/electron dev --home-dir <folder>`, with a fake CLI for
  every provider inside that folder. Never the person's screen, real CLI or
  account. Stop only what you started, by pid.
- Tick each follow-up in the sync pull request's list as its pull request
  opens.

## Afterwards

- [ ] Remove your worktrees once their pull requests merge. Before that,
      clean `.vite`, `.t3`, `dist`, `dist-electron` and lab profiles as soon
      as a run is done with them.
- [ ] Add anything a sync taught to `stemcells/docs/upstream-sync.md`, Notes
      from syncs, in its pull request.
