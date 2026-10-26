/**
 * Where a finished Cell says it stands: the close-out lines every Cell ends a stop with
 * (`@t3tools/provider-core`'s `stemcells/closeOut.ts`), read by code, no model. Facts (a
 * pending request, a run, a failure) outrank it; it outranks the pre-read unless that finds
 * a real question: a Cell called done that still asks is the costly mistake (aski-manager.md).
 */
import { lastParagraph, preRead, type PreRead } from "./preread.ts";

export type Owner = "you" | "me" | "waiting";

export type CloseOut =
  | { readonly kind: "done"; readonly text: string }
  /** A Left with no owner word has none: it may still be the person's. */
  | { readonly kind: "left"; readonly owner: Owner | null; readonly text: string };

/** What a finished reply leaves: the card it makes, if any, and the Cell's own word. */
export interface Stop {
  /** What the person must answer: null when nothing is theirs. */
  readonly ask: PreRead | null;
  /** The Cell waits on something that isn't the person: it is still at work. */
  readonly waits: boolean;
  /** Its own word on where it stands: what it delivered, or what is left. */
  readonly line: string | null;
}

/** A close-out stands among the reply's last lines, after at most an offer of more work. */
const TAIL_LINES = 6;

const LABEL =
  /^\s*(?:[-*+]\s+)?[*_]{0,2}(done|left)(?:[*_]{0,2}\s*:|\s*:[*_]{0,2})[*_]{0,2}\s*(.*?)\s*$/i;
const OWNER = /^[*_]{0,2}(you|me|waiting)[*_]{0,2}(?:\s*[—–:,.]|\s+-\s)[*_]{0,2}\s*(.*)$/i;
/** A step under a bare label: a bulleted or numbered line, or one an owner leads. */
const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(.*?)\s*$/;
/** A Left that names nothing leaves nothing. */
const NOTHING = /^(?:nothing|none|n\/?a|nil|[—–-])[.!]?$/i;
const FENCE = /^\s*(?:```|~~~)/;

const OWNER_RANK: Readonly<Record<Owner | "none", number>> = {
  you: 0,
  none: 1,
  me: 2,
  waiting: 3,
};

/** The reply's lines outside fenced code, each with its index. */
function proseLines(reply: string): ReadonlyArray<{ readonly at: number; readonly text: string }> {
  let inFence = false;
  const kept: Array<{ at: number; text: string }> = [];
  reply.split("\n").forEach((text, at) => {
    if (FENCE.test(text)) {
      inFence = !inFence;
      return;
    }
    if (!inFence && text.trim() !== "") kept.push({ at, text });
  });
  return kept;
}

/**
 * The reply's close-out, and the reply without it. A label may carry its step on its own
 * line, or head a list of them, one owner a line. Of several Lefts, the ones that matter most:
 * the person's, then those with no owner, the Cell's own, then a wait; those at one rank read
 * as one. Any Left outranks a Done.
 */
export function readCloseOut(reply: string): {
  readonly closeOut: CloseOut | null;
  readonly rest: string;
} {
  const lines = proseLines(reply);
  const tailFrom = lines.length - TAIL_LINES;
  const found: CloseOut[] = [];
  const gone = new Set<number>();
  for (let index = 0; index < lines.length; index++) {
    const label = LABEL.exec(lines[index]!.text);
    if (label === null) continue;
    const said = label[2] ?? "";
    const steps = said === "" ? stepsAfter(lines, index) : [];
    const head = lines[index]!.at;
    index += steps.length;
    // The block must reach the reply's last lines: a label far up is part of the report.
    if (index < tailFrom) continue;
    gone.add(head);
    for (const { at } of steps) gone.add(at);
    if (label[1]?.toLowerCase() === "done") {
      found.push({ kind: "done", text: said || steps.map((step) => step.text).join(SEP) });
      continue;
    }
    found.push(...leftsOf(said === "" ? steps : [{ at: head, text: said, indent: 0 }]));
  }
  if (found.length === 0) return { closeOut: null, rest: reply };
  const lefts = found.flatMap((closeOut) => (closeOut.kind === "left" ? [closeOut] : []));
  const rest = reply
    .split("\n")
    .filter((_, at) => !gone.has(at))
    .join("\n");
  if (lefts.length === 0) return { closeOut: found[0]!, rest };
  const rank = (left: (typeof lefts)[number]) => OWNER_RANK[left.owner ?? "none"];
  const top = Math.min(...lefts.map(rank));
  const most = lefts.filter((left) => rank(left) === top);
  return {
    closeOut: {
      kind: "left",
      owner: most[0]!.owner,
      text: most.map((left) => left.text).join(SEP),
    },
    rest,
  };
}

/** Steps read as one, in the order the Cell wrote them. */
const SEP = " · ";

interface Step {
  readonly at: number;
  readonly text: string;
  readonly indent: number;
}

/** The list a bare label heads: its lines up to the first that isn't a step. */
function stepsAfter(lines: ReturnType<typeof proseLines>, label: number): Step[] {
  const steps: Step[] = [];
  for (const { at, text } of lines.slice(label + 1)) {
    if (LABEL.test(text)) break;
    const step = ITEM.exec(text)?.[1] ?? (OWNER.test(text) ? text.trim() : null);
    if (step === null) break;
    steps.push({ at, text: step, indent: text.length - text.trimStart().length });
  }
  return steps;
}

/** A Left's steps. An owner alone on a line owns the steps set in under it. */
function leftsOf(steps: ReadonlyArray<Step>): CloseOut[] {
  const lefts: CloseOut[] = [];
  const parents: Array<{ readonly owner: Owner; readonly indent: number }> = [];
  for (const { text: said, indent } of steps) {
    while (parents.length > 0 && indent <= parents.at(-1)!.indent) parents.pop();
    const owned = OWNER.exec(said);
    const step = (owned?.[2] ?? said).trim();
    const owner = (owned?.[1]?.toLowerCase() as Owner | undefined) ?? parents.at(-1)?.owner ?? null;
    if (owned !== null && step === "" && owner !== null) {
      parents.push({ owner, indent });
      continue;
    }
    if (step === "" || NOTHING.test(step)) continue;
    lefts.push({ kind: "left", owner, text: step });
  }
  return lefts;
}

/** What a finished reply leaves to the person, from its close-out and then its words. */
export function stopOf(reply: string): Stop {
  const { closeOut, rest } = readCloseOut(reply);
  if (closeOut === null) return { ask: preRead(reply), waits: false, line: null };
  if (closeOut.kind === "left" && (closeOut.owner === "you" || closeOut.owner === null)) {
    return { ask: { cue: "left", text: closeOut.text }, waits: false, line: closeOut.text };
  }
  // The Cell says it's done or its own step waits, but a real question in
  // what it wrote still wins: an offer of more work or a "next" doesn't.
  const read = lastParagraph(rest) === "" ? null : preRead(rest);
  if (read?.cue === "question") return { ask: read, waits: false, line: closeOut.text };
  return { ask: null, waits: closeOut.kind === "left", line: closeOut.text };
}
