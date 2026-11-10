/**
 * The room in words, for Aski (`stemcells_standing`): what needs the person under its cards'
 * numbers, then the Cells at work and the done ones not yet settled, every Cell linked. One
 * read answers "what needs me?" instead of the persona listing each project's chats
 * (stemcells/tasks/aski-forward.md, Move 1). Pure.
 */
import type { NeedsList } from "./Needs.ts";
import type { Need } from "./derive.ts";
import type { Brief } from "./evidence.ts";
import type { CellStanding } from "./stage.ts";
import type { Proof } from "./verdict.ts";

export interface Standing {
  readonly needsYou: number;
  readonly atWork: number;
  /** Stopped by a cause many Cells share, such as an account's usage limit. */
  readonly holding: number;
  readonly done: number;
  readonly report: string;
}

/** Long enough to tell asks apart, short enough that ten of them stay one read. */
const SAID = 160;

function clip(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= SAID) return line;
  const cut = line.slice(0, SAID);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), SAID / 2))}…`;
}

const link = (title: string, threadId: string) =>
  `[${title.replace(/[[\]]/g, "")}](t3-thread://v1/${threadId})`;

/** What the card asks, in a few words and the Cell's own. */
function asked(need: Need): string {
  const { request, prose } = need;
  switch (need.kind) {
    case "permission":
      return request?.prompt ? `wants to run: ${clip(request.prompt)}` : "asks for a permission";
    case "question": {
      const [first, ...more] = request?.questions ?? [];
      if (first === undefined) return "asks a question";
      return `asks: ${clip(first.question)}${more.length > 0 ? ` (and ${more.length} more)` : ""}`;
    }
    case "sign-in":
      return "needs you to sign in to its provider again";
    case "input":
      return `${request?.appName ?? "an app"} asks for input`;
    case "failed":
      return need.failure?.message ? `failed: ${clip(need.failure.message)}` : "failed";
    case "plan":
      return need.plan?.title ? `plan ready: ${clip(need.plan.title)}` : "plan ready";
    case "prose": {
      const cue = prose?.cue ?? "question";
      const lead = {
        question: "asks",
        offer: "offers",
        stopped: "stopped short",
        left: "your step",
      };
      return prose ? `${lead[cue]}: ${clip(prose.text)}` : lead[cue];
    }
    case "stuck":
      return need.stuck?.tool?.command
        ? `quiet since ${need.stuck.quietSince} in: ${clip(need.stuck.tool.command)}`
        : `quiet since ${need.stuck?.quietSince ?? need.since}`;
  }
}

/** How a done Cell landed, said so Aski can pass it on without believing a bare "Done". */
const LANDED: Readonly<Record<Proof, string>> = {
  stopped: "landed short: its run was stopped before it finished",
  "rolled-back": "landed short: its run was rolled back",
  failed: "landed short: its run failed",
  "pr-checks-failing": "landed short: its pull request's checks fail",
  "check-failed": "landed short: a check it ran last failed",
  "pr-merged": "shown: its pull request merged",
  "pr-checks-passing": "shown: its pull request's checks pass",
  "checks-clean": "shown: the checks it ran ended clean",
  word: "its word only: nothing it ran or opened shows it",
};

const CHECKS = { test: "tests", typecheck: "typecheck", lint: "lint", build: "build" } as const;

/** What the run shows, as counted facts. */
function facts(brief: Brief | null): ReadonlyArray<string> {
  if (brief === null) return [];
  const { changed, checks, pullRequest } = brief;
  return [
    ...(changed === null
      ? []
      : [`+${changed.additions} −${changed.deletions} in ${changed.files} files`]),
    ...checks.map((check) => `${CHECKS[check.kind]} ${check.ok ? "clean" : "failed"}`),
    ...(pullRequest === null
      ? []
      : [
          `#${pullRequest.number} ${pullRequest.draft ? "draft" : pullRequest.state}${
            pullRequest.state === "open" && pullRequest.checks !== null
              ? `, checks ${pullRequest.checks}`
              : ""
          }${pullRequest.conflicts ? ", conflicts" : ""}`,
        ]),
  ];
}

/** A done Cell's own word, then how it landed and what shows it. */
function landed(cell: CellStanding): string {
  const said = cell.line ? [clip(cell.line)] : [];
  const how = cell.landing === null ? [] : [LANDED[cell.landing.proof]];
  return [...said, ...how, ...facts(cell.brief)].map((part) => ` · ${part}`).join("");
}

export function standingOf(list: NeedsList, projectTitles: ReadonlyMap<string, string>): Standing {
  const project = (projectId: string) => projectTitles.get(projectId) ?? projectId;
  const titles = new Map(list.cells.map((cell) => [cell.threadId, cell.title]));
  const needs = list.needs.toSorted((a, b) => a.number - b.number);
  const atWork = list.cells.filter((cell) => cell.stage === "working" && cell.holds === null);
  const conditions = list.conditions ?? [];
  const holding = conditions.reduce((count, condition) => count + condition.cells.length, 0);
  const done = list.cells.filter((cell) => cell.stage === "done");
  const lines: string[] = [];
  lines.push(needs.length === 0 ? "Nothing needs you." : `Needs you (${needs.length}):`);
  for (const need of needs) {
    const parent = need.parentThreadId === null ? null : titles.get(need.parentThreadId);
    const who = parent ? `${parent} › ${need.title}` : need.title;
    const goal = need.brief?.goal ? ` · told: ${clip(need.brief.goal)}` : "";
    lines.push(
      `${need.number} ${link(who, need.threadId)} · ${project(need.projectId)} · ${asked(need)}${goal}`,
    );
  }
  if (atWork.length > 0) {
    lines.push("", `At work (${atWork.length}):`);
    for (const cell of atWork) {
      const line = cell.line ? ` · ${clip(cell.line)}` : "";
      lines.push(`${link(cell.title, cell.threadId)} · ${project(cell.projectId)}${line}`);
    }
  }
  for (const condition of conditions) {
    const until =
      condition.resetAt === null
        ? "no reset stated"
        : `resets ${condition.resetAt}${condition.waits === "reset" ? ", then they carry on by themselves" : ""}`;
    lines.push(
      "",
      `Holding (${condition.cells.length}): usage limit on ${condition.providerInstanceId}, ${until}. Nothing to answer in any of them:`,
    );
    for (const cell of condition.cells) {
      lines.push(`${link(cell.title, cell.threadId)} · ${project(cell.projectId)}`);
    }
  }
  if (done.length > 0) {
    lines.push("", `Done, not settled (${done.length}):`);
    for (const cell of done) {
      lines.push(`${link(cell.title, cell.threadId)} · ${project(cell.projectId)}${landed(cell)}`);
    }
  }
  return {
    needsYou: needs.length,
    atWork: atWork.length,
    holding,
    done: done.length,
    report: lines.join("\n"),
  };
}
