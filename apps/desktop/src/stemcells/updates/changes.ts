/**
 * What an update holds, read from git: the commits on the track's tip that
 * the running build lacks, one per merged pull request (each squashed, its
 * number at the end of its title) or per merge of T3's own work.
 */
export interface Change {
  readonly title: string;
  readonly number: number | null;
  /** The UTC day it reached main, `20261023`. */
  readonly day: string;
}

/** The format `readChanges` reads, for `git log`: the day, a tab, the subject. */
export const CHANGE_FORMAT = "%cd%x09%s";
export const CHANGE_DATE = "--date=format-local:%Y%m%d";

/** `git log --first-parent` of the commits in `CHANGE_FORMAT`, newest first. */
export function readChanges(log: string): ReadonlyArray<Change> {
  return log
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const tab = line.indexOf("\t");
      return { ...readSubject(line.slice(tab + 1)), day: line.slice(0, tab) };
    });
}

const SQUASHED = /^(.*\S)\s+\(#(\d+)\)$/u;
const MERGED = /^Merge pull request #(\d+) from [^\s/]+\/(\S+)$/u;

function readSubject(subject: string): Omit<Change, "day"> {
  const squashed = SQUASHED.exec(subject);
  if (squashed) return { title: squashed[1]!, number: Number(squashed[2]) };
  const merged = MERGED.exec(subject);
  if (merged) {
    // The nightly sync's branches (stemcells/scripts/sync-upstream).
    const title = merged[2]!.startsWith("sync/upstream") ? "T3's latest work" : merged[2]!;
    return { title, number: Number(merged[1]) };
  }
  return { title: subject, number: null };
}

interface ReleaseNote {
  readonly version: string;
  readonly note: string;
}

/** A release's note as electron-updater hands one over: a list, oldest line first. */
function noteOf(version: string, changes: ReadonlyArray<Change>): ReleaseNote {
  return {
    version,
    note: changes
      .toReversed()
      .map((change) =>
        change.number === null ? `- ${change.title}` : `- ${change.title} (#${change.number})`,
      )
      .join("\n"),
  };
}

/**
 * Notes for an update to a commit on main, `tip` its nightly version's parts.
 * T3 cuts a nightly a day, and upstream's pill lists notes per nightly: here
 * each day's merges are one, its version the one its last commit carries.
 */
export function nightlyNotesOf(
  changes: ReadonlyArray<Change>,
  tip: { readonly base: string; readonly count: number },
): ReadonlyArray<ReleaseNote> {
  const notes: ReleaseNote[] = [];
  let start = 0;
  while (start < changes.length) {
    const day = changes[start]!.day;
    let end = start;
    while (end < changes.length && changes[end]!.day === day) end += 1;
    const version = nightlyVersionOf({ base: tip.base, day, count: tip.count - start });
    notes.push(noteOf(version, changes.slice(start, end)));
    start = end;
  }
  return notes;
}

/** Notes for an update to a release: the one release. */
export function releaseNotesOf(
  changes: ReadonlyArray<Change>,
  version: string,
): ReadonlyArray<ReleaseNote> {
  return changes.length === 0 ? [] : [noteOf(version, changes)];
}

/**
 * A main build's version, upstream's nightly shape, so upstream's updater
 * files it under Nightly. `install-app` stamps the same on a build of main.
 */
export function nightlyVersionOf(input: {
  readonly base: string;
  readonly day: string;
  readonly count: number;
}): string {
  return `${input.base}-nightly.${input.day}.${input.count}`;
}

/** A release tag, `v0.2.0`; a prerelease's tag isn't one. */
export const RELEASE_TAG = /^v(\d+\.\d+\.\d+)$/u;

/**
 * How far a build has come, from the lines `install-app --stage` prints. The
 * steps are what it says it does; their weights are rough shares of a build's
 * time, so the ring only ever moves forward.
 */
const BUILD_STEPS: ReadonlyArray<readonly [needle: string, percent: number]> = [
  ["==> Installing dependencies", 5],
  ["==> Building Stemcells", 10],
  ["Building desktop/server/web artifacts", 15],
  ["Staging release app", 45],
  ["Installing staged production dependencies", 50],
  // The app's package and its archives, the longest step.
  ["Building mac/", 55],
  // The archives it made, listed once they're written.
  [".zip'", 92],
  ["Stemcells is built at", 100],
];

export function buildPercentOf(line: string, previous: number): number {
  let percent = previous;
  for (const [needle, weight] of BUILD_STEPS) {
    if (line.includes(needle)) percent = Math.max(percent, weight);
  }
  return percent;
}
