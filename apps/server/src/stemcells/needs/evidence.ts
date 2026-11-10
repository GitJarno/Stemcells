/**
 * What stands beside a Cell's own words (stemcells/tasks/aski-brief.md, decision 1): what it
 * was told to do, and what its run shows. Read from T3's records, no model. Pure.
 */

/** A message in the person's seat, oldest first: theirs, Aski's, or another Cell's. */
export interface Told {
  readonly text: string;
  /** A wake or a notification: news for the Cell, never an instruction. */
  readonly news: boolean;
}

/** A command the run ran to its end. */
export interface Ran {
  readonly command: string;
  readonly failed: boolean;
}

export interface ChangedFile {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
}

/** What a run left in T3's records, as `upstream/needs.ts` reads it. */
export interface RunRecords {
  readonly told: ReadonlyArray<Told>;
  readonly ran: ReadonlyArray<Ran>;
  readonly files: ReadonlyArray<ChangedFile>;
}

export type CheckKind = "test" | "typecheck" | "lint" | "build";

export interface Check {
  readonly kind: CheckKind;
  /** Its last run in this run ended clean. */
  readonly ok: boolean;
}

export interface PullRequestFact {
  readonly number: number;
  readonly url: string;
  readonly state: "open" | "closed" | "merged";
  readonly draft: boolean;
  readonly checks: "passing" | "failing" | "pending" | null;
  readonly conflicts: boolean;
}

/** What a run's records say, read once: none of it changes after the run. */
export interface RunFacts {
  /** The instruction the Cell is on; null when nobody's words could be read. */
  readonly goal: string | null;
  /** Null when the run changed no file, or its checkpoint couldn't be read. */
  readonly changed: {
    readonly files: number;
    readonly additions: number;
    readonly deletions: number;
  } | null;
  /** Each kind of check the run ran, as it last ended; in a fixed order. */
  readonly checks: ReadonlyArray<Check>;
}

/** The run's facts beside its pull request, which goes on changing after the run. */
export interface Brief extends RunFacts {
  readonly pullRequest: PullRequestFact | null;
}

/** A goal longer than this ends at a word, with an ellipsis. */
export const GOAL_CAP = 280;
/** Fewer words than this is a nudge ("yes, go ahead"), and the instruction before it stands. */
const SUBSTANCE_WORDS = 6;

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);

function capped(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= GOAL_CAP) return line;
  const head = line.slice(0, GOAL_CAP);
  return `${head.slice(0, Math.max(head.lastIndexOf(" "), GOAL_CAP / 2)).trimEnd()}…`;
}

/**
 * The instruction the Cell is on: the last message of substance in the person's seat, else
 * the first anyone gave it.
 */
export function goalOf(told: ReadonlyArray<Told>): string | null {
  const said = told.filter((each) => !each.news && each.text.trim() !== "");
  const goal =
    said.findLast((each) => words(each.text).length >= SUBSTANCE_WORDS) ?? said[0] ?? null;
  return goal === null ? null : capped(goal.text);
}

/**
 * The first match names the kind: "vitest --typecheck" tests, and a build's name comes last
 * because test and lint scripts carry "build" in their paths more often than the reverse.
 */
const KINDS: ReadonlyArray<readonly [CheckKind, RegExp]> = [
  [
    "test",
    /(?:^|[\s/:;&|(])(?:(?:vp|pnpm|npm|yarn|bun|npx|cargo|go|deno|swift|gradle|\.\/gradlew|mvn|make|dotnet)\s+(?:run\s+|exec\s+)?(?:-\S+\s+)*test\b|vitest\b|jest\b|pytest\b|playwright\s+test\b|rspec\b|xcodebuild\s+(?:\S+\s+)*test\b|check:changed\b|check-local\b)/,
  ],
  ["typecheck", /(?:^|[\s/:;&|(])(?:typecheck\b|tsc\b|tsgo\b|mypy\b|pyright\b|cargo\s+check\b)/],
  [
    "lint",
    /(?:^|[\s/:;&|(])(?:lint\b|eslint\b|oxlint\b|biome\s+(?:check|lint)\b|ruff\b|clippy\b|swiftlint\b)/,
  ],
  [
    "build",
    /(?:^|[\s/:;&|(])(?:(?:vp|pnpm|npm|yarn|bun|cargo|go|swift|gradle|\.\/gradlew|make|dotnet)\s+(?:run\s+)?(?:-\S+\s+)*build\b|xcodebuild\b)/,
  ],
];

const ORDER: ReadonlyArray<CheckKind> = KINDS.map(([kind]) => kind);

/** The kind of check a command is; null for anything else a run runs. */
export function checkKindOf(command: string): CheckKind | null {
  return KINDS.find(([, pattern]) => pattern.test(command))?.[0] ?? null;
}

/** Each kind of check the run ran, as its last run of that kind ended. */
export function checksOf(ran: ReadonlyArray<Ran>): ReadonlyArray<Check> {
  const last = new Map<CheckKind, boolean>();
  for (const { command, failed } of ran) {
    const kind = checkKindOf(command);
    if (kind !== null) last.set(kind, !failed);
  }
  return ORDER.flatMap((kind) => {
    const ok = last.get(kind);
    return ok === undefined ? [] : [{ kind, ok }];
  });
}

/** What the run changed: a file touched twice counts once, its lines summed. */
export function changedOf(files: ReadonlyArray<ChangedFile>): RunFacts["changed"] {
  if (files.length === 0) return null;
  return {
    files: new Set(files.map((file) => file.path)).size,
    additions: files.reduce((sum, file) => sum + file.additions, 0),
    deletions: files.reduce((sum, file) => sum + file.deletions, 0),
  };
}

export function factsOf(records: RunRecords): RunFacts {
  return {
    goal: goalOf(records.told),
    changed: changedOf(records.files),
    checks: checksOf(records.ran),
  };
}

/** Null when there is nothing to stand beside the Cell's words. */
export function briefOf(facts: RunFacts | null, pullRequest: PullRequestFact | null): Brief | null {
  if (facts === null && pullRequest === null) return null;
  return { goal: null, changed: null, checks: [], ...facts, pullRequest };
}
