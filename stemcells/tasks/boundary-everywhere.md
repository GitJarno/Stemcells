# The boundary with upstream, in every app

Only an app's `stemcells/upstream/` adapter imports upstream modules
(`stemcells/docs/fork.md`, rule 2), so a change of upstream's shape fails
the type checker in one place per app. The web checked that with a test
and kept to it. The server, the phone and the desktop app had no test, and
the rule had slipped in each.

## What

- [x] One shared check, `stemcells/boundary/check.ts`, and a thin
      `boundary.test.ts` in each app's folder of ours. The web's test now
      runs the shared check; its examples moved to `check.test.ts`.
- [x] The server: five sources and seven tests went through the adapter.
- [x] The phone: two sources and four tests.
- [x] The desktop app: a new adapter, `apps/desktop/src/stemcells/upstream/`,
      for the two modules that imported eight of upstream's.
- [x] `fork.md` rule 2 names all four apps.

## Decisions

- **The web's rule, unchanged in what it exempts:** only `upstream/`.
  Tests are held to it too. What a test stands on of upstream's (a stubbed
  sign-in, upstream's real updater over ours) is a `*.fixture.ts` in the
  adapter, as the server's `needs.fixture.ts` already was. No allowlist.
- **Another app's code of ours is ours.** The phone's `kit.ts` files
  re-export the web's drawing and words by relative path, and a server
  test reads the web's wire shape. Those reach `apps/<app>/src/stemcells/`,
  never upstream, so the check lets them through. Another app's
  `upstream/` adapter is that app's way into upstream, and is refused.
- **A little wider than the web's test was:** `require`, a test's
  `vi.mock` and its kin, `.js`/`.cjs`/`.mjs` files, and upstream's two
  packages outside the `@t3tools/` scope count too. None of our code
  reached upstream those ways; now none can start to.
- **The desktop adapter narrows, where it can.** `upstream/windows.ts`
  hands the windows' host the five things it reads. `upstream/updater.ts`
  builds upstream's updater service from our three steps (check, download,
  swap) and owns the event names upstream listens for and the commit stamp
  its build writes; `updater.contract.test.ts` pins both, and took the
  cases that were already contracts (who imports electron-updater, how
  upstream reads a nightly's version and notes).
- **A composite project lists what it reaches,** so the web's and the
  desktop's `tsconfig.json` gained one `include` line (`seams.md`).

## Verified

- Each app's `boundary.test.ts` passes with no violations, and fails when
  an upstream import is put back outside the adapter.
- Each app's own suite of ours, and the root suite, pass.
- `typecheck` passes for the web, the server, the phone and the desktop.
