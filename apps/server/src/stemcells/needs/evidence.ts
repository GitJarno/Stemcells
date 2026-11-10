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

const ORDER: ReadonlyArray<CheckKind> = ["test", "typecheck", "lint", "build"];

/** Programs that are a check wherever a command runs them. */
const TOOLS: Readonly<Record<string, CheckKind>> = {
  vitest: "test",
  jest: "test",
  pytest: "test",
  rspec: "test",
  "check-local": "test",
  tsc: "typecheck",
  tsgo: "typecheck",
  mypy: "typecheck",
  pyright: "typecheck",
  eslint: "lint",
  oxlint: "lint",
  ruff: "lint",
  swiftlint: "lint",
};

/** What a runner is told to run: `pnpm test` is a check, the shell's own `test -f` is not. */
const SCRIPTS: Readonly<Record<string, CheckKind>> = {
  test: "test",
  "check:changed": "test",
  typecheck: "typecheck",
  lint: "lint",
  clippy: "lint",
  build: "build",
};

/** `check` is a runner's own word: cargo's and deno's read types, biome's lints. */
const CHECK_OF: Readonly<Record<string, CheckKind>> = {
  cargo: "typecheck",
  deno: "typecheck",
  biome: "lint",
};

const RUNNERS = new Set(
  "vp pnpm npm yarn bun npx bunx turbo nx cargo go deno swift gradle gradlew mvn make dotnet uv poetry python python3 playwright biome xcodebuild".split(
    " ",
  ),
);

/** Words that stand before what a command runs without being it. */
const PASSED = new Set(["run", "exec", "x", "dlx", "env", "time", "nice", "command"]);

function scriptKind(runner: string, word: string): CheckKind | null {
  if (word === "check") return CHECK_OF[runner] ?? null;
  return SCRIPTS[word] ?? SCRIPTS[word.replace(/:.*/, "")] ?? null;
}

/**
 * Reads one command up to what it runs, so a word only counts where a program stands: `pnpm
 * add eslint`, `grep lint src` and `cat eslint.config.js` run no check.
 */
function kindOfSegment(segment: string): CheckKind | null {
  let runner: string | null = null;
  let afterFlag = false;
  for (const token of segment.trim().split(/\s+/)) {
    if (token === "" || /^\w+=/.test(token)) continue;
    if (token.startsWith("-")) {
      afterFlag = true;
      continue;
    }
    const word = token.slice(token.lastIndexOf("/") + 1);
    const kind = TOOLS[word] ?? (runner === null ? null : scriptKind(runner, word));
    if (kind != null) return kind;
    if (RUNNERS.has(word)) runner = word;
    else if (!PASSED.has(word) && !afterFlag) return null;
    afterFlag = false;
  }
  return runner === "xcodebuild" ? "build" : null;
}

/**
 * The kind of check a command is; null for anything else a run runs. Quoted text is no command:
 * a commit message that says "fix typecheck" ran none.
 */
export function checkKindOf(command: string): CheckKind | null {
  const kinds = command
    .replace(/"[^"]*"|'[^']*'/g, "_")
    .split(/&&|\|\||[;|\n(){}]/)
    .map(kindOfSegment);
  return ORDER.find((kind) => kinds.includes(kind)) ?? null;
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
