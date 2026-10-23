/**
 * Where a finished Cell says it stands: the close-out lines every Cell is
 * told to end a stop with (the section in `@t3tools/provider-core`'s
 * `stemcells/closeOut.ts`), read by code, with no model.
 *
 *     **Done:** the header fix, merged as #12
 *     **Left:** you — run the sign-in with Drive access
 *     **Left:** waiting — the merge check on #212
 *
 * The facts outrank it (a pending request, a run, a failure), and it
 * outranks the pre-read, except where the pre-read finds a real question:
 * calling a Cell done that still asks is the costly mistake
 * (stemcells/tasks/aski-manager.md, decision 7).
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
const OWNER = /^[*_]{0,2}(you|me|waiting)[*_]{0,2}(?:\s*[—–:,.]|\s+-\s)\s*(.*)$/i;
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
 * The reply's close-out, and the reply without it. Of several Lefts, the
 * one that matters most: the person's, one with no owner, the Cell's own,
 * then a wait. Any Left outranks a Done.
 */
export function readCloseOut(reply: string): {
  readonly closeOut: CloseOut | null;
  readonly rest: string;
} {
  const tail = proseLines(reply).slice(-TAIL_LINES);
  const found: Array<{ at: number; closeOut: CloseOut }> = [];
  for (const { at, text } of tail) {
    const label = LABEL.exec(text);
    if (label === null) continue;
    const said = label[2] ?? "";
    if (label[1]?.toLowerCase() === "done") {
      found.push({ at, closeOut: { kind: "done", text: said } });
      continue;
    }
    const owned = OWNER.exec(said);
    const step = (owned?.[2] ?? said).trim();
    if (step === "" || NOTHING.test(step)) continue;
    const owner = (owned?.[1]?.toLowerCase() as Owner | undefined) ?? null;
    found.push({ at, closeOut: { kind: "left", owner, text: step } });
  }
  if (found.length === 0) return { closeOut: null, rest: reply };
  const lefts = found.flatMap(({ closeOut }) => (closeOut.kind === "left" ? [closeOut] : []));
  const closeOut =
    lefts.length > 0
      ? lefts.reduce((best, left) =>
          OWNER_RANK[left.owner ?? "none"] < OWNER_RANK[best.owner ?? "none"] ? left : best,
        )
      : found[0]!.closeOut;
  const gone = new Set(found.map(({ at }) => at));
  const rest = reply
    .split("\n")
    .filter((_, at) => !gone.has(at))
    .join("\n");
  return { closeOut, rest };
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
