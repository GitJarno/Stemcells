# Updates: what's new, and one click to have it

Stemcells builds from source, so it has no update feed: the person runs
`install-app --pull` and learns what changed from GitHub. Upstream's update
UI (the sidebar pill, its capsule and release notes) is switched off with
upstream's updater. An agent that ran `install-app` from a Cell also lost its
build whenever the app's server restarted, as the build ran in that server's
process tree.

## First principles

- **What's an update?** The app knows the commit it was built from (the
  build stamps `t3codeCommitHash`). An update is the commits on the track's
  tip that the build lacks: on `main`, each one a merged pull request, or a
  sync of T3's work. Their count and titles are the release notes. Nothing
  else needs writing.
- **Where's the truth?** In git, in the repository the app was installed
  from. Asking git is free, works offline for what's already fetched, and
  needs no service of ours. That keeps "Nothing leaves for anyone else's
  cloud": a fetch from the person's own remote is all.
- **What does installing cost?** A build of a few minutes and some disk,
  then a restart. A restart ends every Cell's turn. So building never
  restarts anything. Restarting is the person's choice, once the new app is
  built and waiting.
- **Upstream's updater, our transport.** Upstream's `DesktopUpdates` already
  owns everything around an update: its state, the pill, the track in
  Settings, remote updates, a restart that stops every backend first, and a
  check that the update applied. Only electron-updater, beneath it, can't
  work for a source build. So that's the one piece we replace.
- **One implementation.** `install-app` builds and swaps for the command
  line and for the app alike: `--stage` builds, `--swap-in` swaps. The
  updater only decides when.

## Tracks

- Trunk-based: every pull request merges to `main`, as today.
- A release is a tag (`v0.2.0`) on a `main` commit you're happy with, with
  GitHub's generated notes. No second long-lived branch. A fix to an old
  release, when `main` has moved on, gets a `release/0.2` branch cut from
  its tag.
- Two tracks, upstream's own: **Stable** follows the newest release tag on
  `origin`; **Nightly** follows every merge to `main`. A build knows its
  track by its version, as upstream's do: a release's at its tag, a nightly
  one anywhere else.

## Plan

- [x] `install-app` from inside the app detaches the whole run, build
      included. `--stage` only builds, and `--swap-in` only installs.
- [x] `install-app` records the repository it installed from
      (`updates/source.json` in the app's data folder), stamps the build's
      version (`--version`, or its own reading of the commit) and names
      `origin` as the feed upstream's updater needs to switch on.
- [x] `apps/desktop/src/stemcells/updates/SourceUpdater.ts` is an
      `ElectronUpdater`: fetch and list, `--stage` in a worktree of its
      own, `--swap-in` as the app quits. Upstream's `DesktopUpdates` runs
      on it unchanged.
- [x] A built update waits for its restart while `main` moves on.
- [x] Stable reads `origin`'s tags only; T3's share the repository.
- [x] The web draws upstream's pill, notes, toast and words. A nightly is a
      day's merges, as T3's are. Two substitutes: the count on upstream's
      dot, and a nightly's links to that day's merged pull requests.
- [x] A nightly build keeps the name Stemcells (a seam in the build).
- [x] `install.md` says how updating works; `seams.md` has the seams.

## Releasing, once it's public

1. Merge to `main` as now. Every merge reaches Nightly within minutes.
2. When `main` is in a state you'd hand anyone, release it:
   `gh release create v0.2.0 --target main --generate-notes`. That makes
   the tag on GitHub, never beside T3's in a local clone. Stable gets it,
   and its build says 0.2.0.
3. A fix an old release needs, when `main` has moved on: a `release/0.2`
   branch from its tag, the fix cherry-picked, `v0.2.1` released from there
   (`--target release/0.2`).

## Review

- The first cut replaced upstream's `DesktopUpdates` whole, and a review
  found what that cost: the install lock released too soon, channel changes
  racing checks, a finished build lost as `main` moved. Upstream's service
  already handles each of these. Replacing only electron-updater kept them,
  and shrank ours to a transport.
- The same went for the web: upstream's pill, notes, toast and words, fed
  data in T3's own shapes (a nightly per day, a version that names its
  track), in place of our own list and wording. Upstream's changes to them
  now arrive with each sync.
- Upstream keys tracks and "the update applied" on a build's version, so
  every build carries one; that was the one fact the rest hung on.
- Left open: Stable shows no notes, as upstream's pill shows them only on
  Nightly; the swap still trusts `osascript` to ask the app to quit.
