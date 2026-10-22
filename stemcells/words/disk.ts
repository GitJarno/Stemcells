/**
 * Disk words every surface says the same: the size format, and the cleanup
 * Cell's ask, which the server puts above its own measurement and the web
 * and the phone send to a machine they didn't measure. One copy, so a Cell
 * started from the phone is asked exactly what one from the desktop is.
 */

/** "107 GB", "940 MB", "1.2 TB": decimal units, as Finder counts. */
export function diskBytes(bytes: number): string {
  const value = Math.max(0, bytes);
  const format = (scaled: number, unit: string) => {
    const text = scaled.toFixed(scaled < 10 ? 1 : 0);
    return `${text.endsWith(".0") ? text.slice(0, -2) : text} ${unit}`;
  };
  if (value >= 1e12) return format(value / 1e12, "TB");
  if (value >= 1e9) return format(value / 1e9, "GB");
  if (value >= 1e6) return format(value / 1e6, "MB");
  if (value >= 1e3) return format(value / 1e3, "KB");
  return `${Math.trunc(value)} bytes`;
}

/** The machine a Cell frees, as the ask names it when no client measured it. */
export const ITS_OWN_MACHINE = "the machine you run on";

/** What a cleanup Cell does, as a person reads it before starting one. */
export const CLEANUP_PROMISE =
  "A Cell lists what can go as Low, Medium and High risk, and removes only what you name: “delete L1, L3 and M5”.";

/**
 * The cleanup Cell's first message: look first, read-only; one list in
 * three tiers whose IDs (L1, M2, H1) the person answers with; remove only
 * the IDs they name. High is theirs to weigh, so it is listed, never chosen.
 */
export function cleanupAsk(machine: string): string {
  return `Free space on ${machine}: find what can go, show me in three tiers, and remove only what I name.

First look, read-only (df, du, git status, git log, lsof; no deletions, no moves), and note the free space now with df. Where to look:
- Build output and dependency folders (.build, DerivedData, node_modules, target, dist, .next and the like) in checkouts nobody is working in.
- Git worktrees whose branch is merged or fully pushed.
- Caches: ~/Library/Caches on a Mac, ~/.cache on Linux, package and toolchain caches (npm, pnpm, pip, Homebrew, Playwright's browsers), Xcode device support, simulators and runtimes nothing uses, toolchain versions nothing uses.
- Temporary files in $TMPDIR and /tmp, old logs and crash reports, the Trash.
- Apps I don't seem to use, and the largest folders in Documents, Desktop, Downloads, Music, Movies, Pictures and ~/Library/Application Support: their names and sizes only, never a file's contents. Never read Mail, Messages, a Photos library, iCloud Drive, ~/Library/Containers or other volumes.
- Local snapshots (tmutil listlocalsnapshots /) and purgeable space hold space macOS frees by itself: say so if they're large, don't list them.

Then one list in three tiers, largest first within each, every item with an ID I can answer with: L1, L2 … for Low, M1 … for Medium, H1 … for High. Each line: what it is and where, its size (measured, or say it's an estimate), and how it comes back.
- Low: nothing of mine is lost. It comes back by itself or with one command: caches, build output, dependency folders.
- Medium: nothing personal, but it comes back only with time, a download or a rebuild, or not at all by my choice: merged worktrees, simulators and runtimes, apps, installers in Downloads, the Trash.
- High: mine, or possibly the only copy: documents, media, backups, apps' data and databases, everything else in Downloads. List it so I can decide, and say if you know of another copy.
Open with each tier's total, counting shared space once. End with "Not touched" and why: the system, keychains and credentials, settings, the state of Stemcells and of T3 (~/.stemcells, ~/.t3), checkouts with uncommitted or unpushed work (someone may be working in them), anything a running process uses, and anything you couldn't check.

Delete nothing until I reply with IDs ("delete L1, L3 and M5", or "all L"). Then remove exactly those. Right before removing each, check it again: still there, unchanged, nothing using it, and for a checkout no uncommitted or unpushed work; skip any that changed and say why. Use the owner's command where there is one (git worktree remove without --force, pnpm store prune, xcrun simctl delete, brew cleanup), otherwise rm -rf on one full path: never a wildcard, never sudo (give me the command to run myself instead). End with the space that came back, from df before and after: sizes overstate what deleting an APFS clone or a hard-linked copy returns.`;
}
