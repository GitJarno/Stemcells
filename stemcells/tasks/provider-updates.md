# Provider updates: offered only when they can land, and said where Stemcells' own is

The person, 2026-10-31: provider updates never work, and their result is a red toast that reads
"Updated 1 provider" over a line saying the update didn't take. It should be the banner
Stemcells' own update has.

## Why they never worked

A provider's advisory compares its version with the registry's `latest` tag. An npm install
updates with `npm install -g <pkg>@latest`, and npm's `min-release-age` (a supply-chain guard
a person sets in `~/.npmrc`) makes that take the newest release old enough, then exit 0. Codex
ships every two to four days, so with a week's age there's always a newer release too young
to install: the advisory said "behind", the update installed the same version, and the runner
reported "still outdated", every time. Upstream's pending `npm view` lookup (#27847) has the
same gap: `npm view <pkg>@latest` ignores the age.

## The rule

- An update is offered only when its own installer would install it. For npm, that's npm's
  answer for the install's prefix (`npm outdated -g --prefix <p> --json <pkg>`, then
  `npm ls` when nothing is outdated), as pnpm's already is. The person's age policy stands;
  Stemcells never routes around it. When npm can't answer, the registry's tag is the fallback.
- The Cells column says what gets better in one banner: Stemcells, the providers, or both
  ("Stemcells and Codex get better"). Its popover lists each provider's version step, then
  the app's changes. One Update takes them all: providers at once (no restart), the app as
  before (restarts once no Cell is flying).
- The banner says how it goes: "Updating Codex…", then the provider leaves the banner, or
  "Couldn't update Codex" with the reason and Try again. No toast.
- Only one-click updates show: an install Stemcells can't drive stays in Settings.

## Plan

- [x] Server: npm-global installs ask npm for the version it would install (seam in
      `maintenanceResolver.ts`, its test `maintenanceResolver.npmReleaseAge.test.ts`)
- [x] Web: provider updates in the banner (`updates/providers.ts`, `UpdateBanner.tsx`,
      `Cells.tsx`), the pill out of the foot while the banner speaks
- [x] Tests: the view table; the column's browser test for providers
- [x] seams.md, `install.md`, drift
- [x] The gates, check-local

## Review

- The root cause was the person's own npm policy, not a broken updater: npm installed exactly
  what it was told, and the advisory asked a different question. Asking the installer is the
  same fix upstream already made for pnpm.
- An independent review found that a provider's failure hid the app's "Restarts once your
  Cells finish" and its Restart now. The app's progress now keeps the line, and Restart now
  sits beside Try again. A click's own failures are kept per version, and only what it
  started reads as updating.
- Left as upstream has them: Settings' provider rows, the narrow rail and the list column,
  and an npm that takes longer than the probe's 10 s, which falls back to the registry's tag.
