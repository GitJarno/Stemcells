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
  | {
      readonly kind: "left";
      readonly owner: Owner | null;
      /** The steps of the owner that matters most, read as one. */
      readonly text: string;
      readonly steps: ReadonlyArray<string>;
      /** The Cell's own steps, read as one, when someone else's come first. */
      readonly next: string | null;
    };

/** One step of a Left, before the Lefts are ranked. */
type Owned = { readonly owner: Owner | null; readonly text: string };

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
  const found: Array<{ readonly kind: "done"; readonly text: string } | Owned> = [];
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
  const lefts = found.flatMap((each) => ("owner" in each ? [each] : []));
  const rest = reply
    .split("\n")
    .filter((_, at) => !gone.has(at))
    .join("\n");
  if (lefts.length === 0) {
    const done = found.find((each) => !("owner" in each));
    return { closeOut: done === undefined ? null : { kind: "done", text: done.text }, rest };
  }
  const rank = (left: Owned) => OWNER_RANK[left.owner ?? "none"];
  const top = Math.min(...lefts.map(rank));
  const steps = lefts.filter((left) => rank(left) === top).map((left) => left.text);
  const mine = lefts.filter((left) => left.owner === "me").map((left) => left.text);
  return {
    closeOut: {
      kind: "left",
      owner: lefts.find((left) => rank(left) === top)!.owner,
      text: steps.join(SEP),
      steps,
      next: top < OWNER_RANK.me && mine.length > 0 ? mine.join(SEP) : null,
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
function leftsOf(steps: ReadonlyArray<Step>): Owned[] {
  const lefts: Owned[] = [];
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
    lefts.push({ owner, text: step });
  }
  return lefts;
}

/** What a finished reply leaves to the person, from its close-out and then its words. */
export function stopOf(reply: string): Stop {
  const { closeOut, rest } = readCloseOut(reply);
  if (closeOut === null) return { ask: preRead(reply), waits: false, line: null };
  if (closeOut.kind === "left" && (closeOut.owner === "you" || closeOut.owner === null)) {
    const { text, steps, next } = closeOut;
    return { ask: { cue: "left", text, steps, next }, waits: false, line: text };
  }
  // The Cell says it's done or its own step waits, but a real question in
  // what it wrote still wins: an offer of more work or a "next" doesn't.
  const read = lastParagraph(rest) === "" ? null : preRead(rest);
  if (read?.cue === "question") return { ask: read, waits: false, line: closeOut.text };
  return { ask: null, waits: closeOut.kind === "left", line: closeOut.text };
}
