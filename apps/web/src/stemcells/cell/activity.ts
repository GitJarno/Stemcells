// What a Cell is doing right now, as its character can act it out: only
// what the transcript truly says. A turn with no call in flight is the
// model thinking (57 % of busy time over 246 h of real transcripts); a call
// in flight names the work.

export type Activity =
  | "thinking"
  | "reading"
  | "searching"
  | "editing"
  | "delegating"
  | "running"
  | "testing"
  | "building"
  | "shipping"
  | "waiting"
  | "browsing";

export const ACTIVITIES: readonly Activity[] = [
  "thinking",
  "reading",
  "searching",
  "editing",
  "delegating",
  "running",
  "testing",
  "building",
  "shipping",
  "waiting",
  "browsing",
];

/** A tool call in a turn: its tool's name, what it was pointed at in one short line, and whether it is still in flight. */
export interface ToolBeat {
  readonly name: string;
  readonly brief: string;
  readonly state: "requested" | "returned" | "failed";
}

/** The activity of the turn in progress: its newest call still in flight, else thinking. Undefined when the Cell is not working. */
export function currentActivity(busy: boolean, tools: readonly ToolBeat[]): Activity | undefined {
  if (!busy) return undefined;
  const call = tools.at(-1);
  if (call === undefined || call.state !== "requested") return "thinking";
  return activityOf(call.name, call.brief);
}

/** The most buds a Cell shows beside it, however many subagents work for it. */
export const BUDS_MOST = 2;

/**
 * How many buds stand beside a Cell: its subagents at work, at most
 * `BUDS_MOST`. Those its turn waits on are its calls still in flight; those
 * gone to the background (`away`) work on after the turn. One subagent can
 * be both while the turn runs on, so the larger count is the truer one.
 */
export function budsOf(tools: readonly ToolBeat[], away = 0): number {
  const working = tools.filter(
    (call) => call.state === "requested" && activityOf(call.name, call.brief) === "delegating",
  );
  return Math.min(Math.max(working.length, away), BUDS_MOST);
}

/** A call's activity from its tool name and its one-line brief. */
export function activityOf(tool: string, brief: string): Activity {
  switch (tool.toLowerCase()) {
    case "read":
    case "notebookread":
    case "ls":
    case "view":
    case "read_file":
      return "reading";
    case "grep":
    case "glob":
    case "search":
    case "find":
    case "codebase_search":
    case "file_search":
      return "searching";
    case "edit":
    case "write":
    case "multiedit":
    case "notebookedit":
    case "apply_patch":
      return "editing";
    case "webfetch":
    case "websearch":
    case "web_search":
    case "web_fetch":
    case "fetch":
      return "browsing";
    case "bash":
    case "shell":
    case "exec_command":
    case "local_shell":
    case "run_shell_command":
      return commandActivity(brief);
    case "task":
    case "agent":
      return "delegating";
    case "todowrite":
    case "exitplanmode":
      return "thinking";
    default:
      return "running";
  }
}

/** A shell command's activity from its first words. Unknown → running. */
export function commandActivity(brief: string): Activity {
  // Trims spaces and tabs only: a newline stays part of the line.
  const line = brief.toLowerCase().replace(/^[\p{Zs}\t]+|[\p{Zs}\t]+$/gu, "");
  const words = line.split(/[ \t]/).filter((word) => word !== "");
  const first = words[0];
  if (first === undefined) return "running";
  const second = words[1] ?? "";
  const has = (needles: readonly string[]): boolean =>
    needles.some((needle) => line.includes(needle));
  if (["sleep", "until", "wait", "timeout"].includes(first)) return "waiting";
  if (first === "git") {
    if (["commit", "push", "merge", "rebase", "tag", "cherry-pick"].includes(second))
      return "shipping";
    return "reading";
  }
  if (first === "gh" && ["pr", "release"].includes(second)) return "shipping";
  // The verb decides before any word in its arguments: `grep test` searches.
  if (["grep", "rg", "find", "fd", "ag", "ack"].includes(first)) return "searching";
  if (
    [
      "cat",
      "head",
      "tail",
      "less",
      "ls",
      "wc",
      "sed",
      "awk",
      "jq",
      "tree",
      "stat",
      "file",
    ].includes(first)
  ) {
    return "reading";
  }
  if (["curl", "wget"].includes(first)) return "browsing";
  if (has(["test", "pytest", "jest", "vitest", "rspec", "make check", "xctest"])) return "testing";
  if (has(["make merge", "npm publish", "vercel", "deploy"])) return "shipping";
  if (has(["build", "swiftc", "xcodebuild", "tsc", "make", "cargo", "gradle", "webpack", "vite"])) {
    return "building";
  }
  return "running";
}

/** How long a new activity must last before it shows, and how long a shown one stays, in milliseconds. */
export const ACTIVITY_DEBOUNCE = 3000;
export const ACTIVITY_HOLD = 8000;

/**
 * Debounce and hold for what a Cell shows (measured over 246 h of busy time:
 * a new activity must last 3 s before it shows, and a shown one stays at
 * least 8 s, 94 % of the time right, under one switch a busy minute).
 * Starting and stopping work show at once. Times are in milliseconds.
 */
export class ActivityHold {
  #shown: Activity | undefined;
  #shownSince = Number.NEGATIVE_INFINITY;
  #pending: Activity | undefined;
  #pendingSince = Number.NEGATIVE_INFINITY;

  get shown(): Activity | undefined {
    return this.#shown;
  }

  /** Folds in the raw activity at `now`; returns when to look again, if a pending change could be promoted later without any new input. */
  update(raw: Activity | undefined, now: number): number | undefined {
    if (raw === undefined) {
      this.#shown = undefined;
      this.#shownSince = Number.NEGATIVE_INFINITY;
      this.#pending = undefined;
      this.#pendingSince = Number.NEGATIVE_INFINITY;
      return undefined;
    }
    if (this.#shown === undefined) {
      this.#shown = raw;
      this.#shownSince = now;
      this.#pending = undefined;
      return undefined;
    }
    if (raw === this.#shown) {
      this.#pending = undefined;
      return undefined;
    }
    if (raw !== this.#pending) {
      this.#pending = raw;
      this.#pendingSince = now;
    }
    const ready = Math.max(
      this.#pendingSince + ACTIVITY_DEBOUNCE,
      this.#shownSince + ACTIVITY_HOLD,
    );
    if (now >= ready) {
      this.#shown = raw;
      this.#shownSince = now;
      this.#pending = undefined;
      return undefined;
    }
    return ready;
  }
}
