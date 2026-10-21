# Stemcells — house rules for agents

Stemcells is T3 Code with a layer of its own. Three layers:

1. **The labs** make the intelligence: models and their CLIs.
2. **T3 Code** (`upstream`, merged nightly) is the infrastructure: providers,
   threads, the server, remote access, security.
3. **Stemcells** is the experience: tabs and panes, Aski (the one you talk
   to, who runs the others), Cells (each chat, with a creature of its own),
   delight, and the words a person reads.

The fork exists to keep taking upstream's work for free. The reasoning is in
`stemcells/docs/fork.md`; read it before your first change. The rules:

## Where you work
- In your own worktree, never in the main checkout. From the main
  checkout: `git worktree add ../Stemcells-wt/<task> -b stemcells/<task>
  origin/main`, then `pnpm install --frozen-lockfile --prefer-offline`
  inside it.
- Remove your worktree once its pull request merges.

## Where code goes
- Ours lives in `apps/web/src/stemcells/`, `apps/server/src/stemcells/`,
  `apps/mobile/src/stemcells/`, and `stemcells/` for docs, plans
  (`stemcells/tasks/`) and scripts. A `packages/stemcells-*` package only
  once two apps share the code: every new package rewrites upstream's
  `pnpm-lock.yaml`, the file every sync touches.
- An upstream file changes only at a **seam**: the smallest edit that hands
  control to our code. List it in `stemcells/seams.md`, with its reason,
  in the same commit. A seam that only swaps a module or wraps an export
  is a substitute instead (`seams.md`, Substitutes).
- `drift` marks a seam file upstream edits about daily as `hot`. Before a
  feature touches a hot file, its seam gets a substitute or an extension
  point (`stemcells/docs/fork.md`, rule 7).
- `stemcells/scripts/drift` before every push: it fails on an upstream
  change `seams.md` doesn't name.
- Only the `stemcells/upstream/` adapters import upstream modules. Every
  upstream behaviour we rely on gets a contract test in our tree.
- Our state lives in our own store, our endpoints under `/api/stemcells/`.
  Never a migration in upstream's sequence, never a column on their tables.
- Never reformat, rename, move or tidy upstream code. A change any T3 user
  would want goes upstream first (a branch from `upstream/main`); until it
  lands, it's a seam that names the pull request.

## Taking upstream's work
- `stemcells/scripts/sync-upstream` merges `upstream/main` on a branch and
  opens a pull request. Merge, never rebase or squash upstream history.
- In a conflict, upstream's logic wins and our seam goes back on top. The
  pull request says how many minutes resolving took;
  `stemcells/scripts/sync-stats` lists each sync's conflicts.

## Nothing leaves for anyone else's cloud
- No telemetry or usage data, to T3 or anyone else: the server's analytics
  service is a no-op (`seams.md`, No telemetry). Turn off anything a sync
  adds that reports on the person.
- No `.env` made from `.env.example`, and none of the `T3CODE_RELAY_URL`,
  `T3CODE_CLERK_*` or `T3CODE_*OTLP*` variables set: they connect to
  upstream's hosted services.
- Stemcells has its own identity and runs beside T3 Code: bundle id
  `sh.stemcells.app`, state in `~/.stemcells`, app data in
  `~/Library/Application Support/sh.stemcells.app`. Never touch `~/.t3`.

## Words
- Words a person reads in our layer say Cell and Aski. Upstream's strings
  stay until one of our views replaces the one that shows them.

## Keeping it publishable
- Write every file as if the repo went public tomorrow: no real people,
  accounts, devices or private folders in code, tests, docs or images.
- `LICENSE` stays exactly as upstream ships it.

## Dev loop
Upstream's `AGENTS.md` covers the toolchain (pnpm, `vp`, Effect). In short:
`pnpm install`, `stemcells/lab/electron dev` (the desktop dev app, below),
`pnpm exec vp test run <files>` (the web's from `apps/web`, whose config has
our substitutes), `pnpm --filter @t3tools/web typecheck`,
`pnpm exec vp lint`. To build and install the app:
`stemcells/scripts/install-app` (`stemcells/docs/install.md`).

Electron starts only through `stemcells/lab/electron`: `dev` for the dev
app, or a scratch app's main. It loads `stemcells/lab/never-shown.cjs`, so
no window reaches the screen of the person at the Mac, and one that does
ends the lab. `stemcells/lab/launches.test.ts` fails on any other way in.
