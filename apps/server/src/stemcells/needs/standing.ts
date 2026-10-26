/**
 * The room in words, for Aski (`stemcells_standing`): what needs the person under its cards'
 * numbers, then the Cells at work and the done ones not yet settled, every Cell linked. One
 * read answers "what needs me?" instead of the persona listing each project's chats
 * (stemcells/tasks/aski-forward.md, Move 1). Pure.
 */
import type { NeedsList } from "./Needs.ts";
import type { Need } from "./derive.ts";

export interface Standing {
  readonly needsYou: number;
  readonly atWork: number;
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
    case "limit":
      return need.limit?.resetAt
        ? `out of its usage limit until ${need.limit.resetAt}`
        : "out of its usage limit";
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

export function standingOf(list: NeedsList, projectTitles: ReadonlyMap<string, string>): Standing {
  const project = (projectId: string) => projectTitles.get(projectId) ?? projectId;
  const titles = new Map(list.cells.map((cell) => [cell.threadId, cell.title]));
  const needs = list.needs.toSorted((a, b) => a.number - b.number);
  const atWork = list.cells.filter((cell) => cell.stage === "working");
  const done = list.cells.filter((cell) => cell.stage === "done");
  const lines: string[] = [];
  lines.push(needs.length === 0 ? "Nothing needs you." : `Needs you (${needs.length}):`);
  for (const need of needs) {
    const parent = need.parentThreadId === null ? null : titles.get(need.parentThreadId);
    const who = parent ? `${parent} › ${need.title}` : need.title;
    lines.push(
      `${need.number} ${link(who, need.threadId)} · ${project(need.projectId)} · ${asked(need)}`,
    );
  }
  if (atWork.length > 0) {
    lines.push("", `At work (${atWork.length}):`);
    for (const cell of atWork) {
      const line = cell.line ? ` · ${clip(cell.line)}` : "";
      lines.push(`${link(cell.title, cell.threadId)} · ${project(cell.projectId)}${line}`);
    }
  }
  if (done.length > 0) {
    lines.push("", `Done, not settled (${done.length}):`);
    for (const cell of done) {
      const line = cell.line ? ` · ${clip(cell.line)}` : "";
      lines.push(`${link(cell.title, cell.threadId)} · ${project(cell.projectId)}${line}`);
    }
  }
  return {
    needsYou: needs.length,
    atWork: atWork.length,
    done: done.length,
    report: lines.join("\n"),
  };
}
