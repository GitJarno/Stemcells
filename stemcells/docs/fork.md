# How Stemcells stays on T3

Stemcells is T3 Code plus a layer of its own. T3's team keeps building
providers, models, remote access and security; Stemcells builds the
experience on top. This document is how we keep taking their work cheaply
for as long as Stemcells exists, while building ours freely.

## What taking upstream's work costs

Every time we merge `upstream/main` we can pay in three ways:

1. **Conflicts.** Git can't merge a line both sides changed. The cost grows
   with how many upstream lines we've changed, times how often upstream
   touches those lines.
2. **Silent breakage.** The merge is clean, but something we relied on
   changed meaning: a renamed field, a new status value, a component that
   now needs a prop. This is worse than a conflict because nothing points
   at it. The cost grows with how much of upstream's code we lean on, and
   how deep inside it we reach.
3. **Fixes we carry alone.** A change we make to upstream code that
   upstream never gets is ours to re-apply and defend on every merge,
   forever.

Each rule below exists to lower one of these. When a rule doesn't fit a
case, go back to the three costs and choose what keeps them lowest.

## 1. Add, don't edit — against conflicts

- Our code lives in our own folders:
  - `apps/web/src/stemcells/`
  - `apps/server/src/stemcells/`
  - `apps/mobile/src/stemcells/`
  - `packages/stemcells-*`
  - `stemcells/` for docs, plans and scripts.

  New files never conflict.
- An upstream file changes only at a **seam**: the smallest edit that hands
  control to our code, ideally an import and one line. Every seam is listed
  in `stemcells/seams.md` with its reason.
- Put seams where upstream rarely edits: route roots, registries,
  constants. Avoid the files upstream changes every day. `drift` shows each
  seam file's upstream commits over the last 90 days; a hot file is a bad
  place for a seam.
- **In a hot file, all of ours comes through one import, on its first
  line** (`import * as Stemcells from …`). Upstream edits its import
  blocks every day and rarely a file's first line; our import lines in the
  middle of the block were most of the 2026-10-21 sync's code conflicts
  (`seams.md`, One import per hot file).
- **A seam that only swaps a module or wraps an export is a substitute
  instead.** The web's and the phone's builds hand upstream's code our
  module where it imports one of upstream's, so the importing file stays
  untouched (`seams.md`, Substitutes).
- Never reformat, rename, move or tidy upstream code. Each of those is a
  conflict waiting for the next merge.
- `stemcells/scripts/drift` fails on any changed upstream file that
  `seams.md` doesn't name. It prints the total, so the fork's size is
  always visible.

## 2. Lean on contracts, not internals — against silent breakage

- **One adapter per app.** Only `apps/web/src/stemcells/upstream/` and
  `apps/server/src/stemcells/upstream/` import upstream modules. The rest
  of our code imports from those adapters. When upstream changes shape,
  the type checker fails inside the adapter, and that's the one place to
  fix.
- **Prefer upstream's public surfaces**, which they also have to keep
  stable for themselves. In rough order:
  1. The schemas in `@t3tools/contracts`.
  2. The state hooks in `client-runtime`.
  3. Settings.
  4. Provider `launchArgs`.
  5. The orchestration MCP tools.
  6. Keybinding config.

  A component's internals come last.
- **Contract tests.** Every upstream behaviour we depend on gets a test in
  our tree that pins it. Examples: the thread status values we map to a
  Cell's mood, the MCP tool names Aski calls, `ChatView` rendering a thread
  from props. These run on every sync, and a red one names the contract
  that moved.
- **Boundaries are checked, not trusted.** A test in our tree fails when
  our code imports upstream outside an adapter.

## 3. Own our state and our wire

- **Upstream owns its database and migrations.** We never add a migration
  to their sequence: the numbers would collide on the next merge, and
  leaving their schema would no longer be possible.
- **Our durable state lives in our own store:** tab layouts, Cell
  identities, achievements, Aski's memory.
  - UI-only state goes in browser storage under a `stemcells.` prefix.
  - Server state goes in our own SQLite file under `~/.stemcells`.
  - Upstream IDs (thread, project, environment) are our keys. We never add
    columns to their tables.
- **Our server endpoints live under `/api/stemcells/`**, mounted with one
  seam. We don't add methods to their RPC group, which every upstream
  feature edits.

## 4. Compose the interface, don't rewrite it

- **Wrap upstream components and replace whole views at the route.** Our
  pane renders their `ChatView`, and our tab strip sits around their
  outlet. Never copy a component to change it: a copied 6,000-line file is
  a fork inside the fork.
- **Our design tokens live in our own CSS layer.** It overrides upstream's
  variables through the cascade. We don't edit their stylesheet.
- **Words:** our views say Cell and Aski. Upstream's strings stay until one
  of our views replaces the one that shows them.

## 5. Upstream first — against fixes we carry alone

- **Ask of every change: would any T3 user want this?** That covers bug
  fixes and extension points. Examples: "register a settings page",
  "`ChatView` safe to render twice", "a system prompt per thread".
  - **If yes**, it belongs upstream. Build it on a branch from
    `upstream/main`, so the pull request carries nothing of ours, and offer
    it to T3. Until they merge it, we carry it as a seam that names the
    pull request. Once they merge it, the next sync deletes our seam.
  - **If no**, it's Stemcells' own and lives in our folders: identity,
    Aski, Cells, delight.
- Every extension point upstream accepts makes the fork permanently
  smaller. This is how we contribute to what we care about and get paid
  back in maintenance.

## 6. Sync small and often

- **Nightly.** Conflicts and breakage get harder to understand with every
  commit in a batch. One day of upstream is small enough to read.
- **Merge, never rebase or squash upstream's history.** Shared history is
  how git knows what we've already taken; rewriting it turns every past
  merge into a future conflict.
- **Take upstream's green commits.** Sync to the newest upstream commit
  whose CI passed, not blindly to the tip.
- **The nightly pipeline** (the runbook: `upstream-sync.md`), on a Mac,
  as GitHub Actions is off for Stemcells: `install-nightly-sync` (opt in)
  has launchd run it at 03:00, on AC power and when the Mac isn't busy.
  1. `sync-upstream` merges on a branch, and resolves conflicts in
     upstream's tests itself.
  2. `sync-upstream --gates`: drift, nothing reporting on the person, types,
     lint, our tests, upstream's suites, the builds and a headless boot.
  3. If green, `sync-upstream --pr` opens the pull request, with a report.
     If it conflicts or goes red, one issue says where, and a Cell resolves
     it: upstream's logic wins and our seam goes back on top.
- **Nothing merges unchecked.** A pull request merges once its exact head
  carries `local-check` = success, which `check-local` records after
  running the `check` gates (`stemcells/AGENTS.md`, Landing).
- **A seam that conflicts twice is a signal.** Move more of it into our
  files, or make it upstream's extension point (rule 5 and rule 7).

## 7. Watch the numbers

- **What a sync costs: conflicts per sync, and the minutes to resolve
  them.** That's the number to keep low. A merge that comes in clean costs
  nothing; a conflict costs a person's or a Cell's attention.
  `stemcells/scripts/sync-stats` replays every upstream merge on main and
  lists the files that conflicted. The pull request that resolves one says
  how many minutes the resolving took.
- **What predicts it: seam files and their heat.** `drift` lists every
  upstream file we change, with upstream's commits to it in the last 90
  days, and marks a file over 90 as hot: upstream edits it about every day,
  so every nightly sync can conflict there. The file count alone predicts
  little. Most seam files are cold and never conflict, and new files never
  do.
- **The rule:** a seam in a hot file, or one that has conflicted twice,
  gets a substitute or an extension point (rule 5) before a new feature
  touches that file.

Why 90: on 2026-10-21, seam heat over 60 days ran from 78 to 310 for the
eleven hottest files and 50 or less for the rest, with nothing in between.
90 days to 90 commits is the same line. The first measured sync took 21
upstream commits and conflicted in 2 files, both test expectations; its
conflicts took about 2 minutes to resolve, and its checks about 20
(`stemcells/tasks/seam-debt.md`).

## What we don't do, and why

- **No patch stacks** (patch files re-applied on each update). Git can't
  see through them, so every update re-solves the same conflicts. Real
  merges remember.
- **No vendoring of upstream as a package.** Their packages are private,
  unversioned and change together. A copy would freeze us on old code.
- **No long-lived side branches.** Anything that lives outside `main`
  drifts twice: from us and from upstream.
