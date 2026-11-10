/**
 * What a run shows, as a person reads it beside an ask (stemcells/tasks/aski-brief.md, decision
 * 3): lines changed, each check as it last ended, and the pull request. A fact the records
 * don't have is left out. Pure; the phone draws the same (`line/kit.ts`).
 */
import type { Brief } from "./wire";

/** Whether a fact says the work stands, says it doesn't, or only counts. */
export type Tone = "good" | "bad" | "plain";

export interface Fact {
  readonly id: string;
  readonly text: string;
  readonly tone: Tone;
  /** Where the fact can be seen: the pull request's page. */
  readonly href: string | null;
}

/** The share of a change that added or removed lines, in five cells. */
export type BarCell = "added" | "removed";
const BAR_CELLS = 5;

const CHECKS = { test: "Tests", typecheck: "Typecheck", lint: "Lint", build: "Build" } as const;

const count = (n: number) => n.toLocaleString("en-US");

/**
 * Five cells split by added and removed lines; a side with any lines keeps at least one cell.
 * Empty when no line changed (a rename, a mode change).
 */
export function barOf(changed: Brief["changed"]): ReadonlyArray<BarCell> {
  if (changed === null) return [];
  const total = changed.additions + changed.deletions;
  if (total === 0) return [];
  const share = Math.round((changed.additions / total) * BAR_CELLS);
  const added =
    changed.additions === 0
      ? 0
      : changed.deletions === 0
        ? BAR_CELLS
        : Math.min(BAR_CELLS - 1, Math.max(1, share));
  return Array.from({ length: BAR_CELLS }, (_, index) => (index < added ? "added" : "removed"));
}

/** "+340 −88 · 12 files", as the diff panel counts them. */
export function changedWords(changed: NonNullable<Brief["changed"]>): string {
  const files = changed.files === 1 ? "1 file" : `${count(changed.files)} files`;
  return `+${count(changed.additions)} −${count(changed.deletions)} · ${files}`;
}

function pullRequestFact(pullRequest: NonNullable<Brief["pullRequest"]>): Fact {
  const { number, state, checks, conflicts, draft, url } = pullRequest;
  const open = state === "open";
  const said = [
    `#${number}`,
    open ? (draft ? "draft" : "open") : state,
    ...(open && checks !== null ? [`checks ${checks}`] : []),
    ...(open && conflicts ? ["conflicts"] : []),
  ];
  const tone: Tone =
    open && (checks === "failing" || conflicts)
      ? "bad"
      : state === "merged" || (open && checks === "passing")
        ? "good"
        : "plain";
  return { id: "pull-request", text: said.join(" · "), tone, href: url };
}

/** The run's facts in reading order: what it ran, then where its work went. */
export function factsOf(brief: Brief | null | undefined): ReadonlyArray<Fact> {
  if (brief == null) return [];
  return [
    ...brief.checks.map((check): Fact => ({
      id: check.kind,
      text: `${CHECKS[check.kind]} ${check.ok ? "passed" : "failed"}`,
      tone: check.ok ? "good" : "bad",
      href: null,
    })),
    ...(brief.pullRequest === null ? [] : [pullRequestFact(brief.pullRequest)]),
  ];
}
