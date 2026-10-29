/**
 * What an ask carries from the rest of its Cell's reply (stemcells/tasks/unblocking.md,
 * decision 2): the reply's opening paragraph, which says what the Cell did. Pure, no model.
 */
import { readCloseOut } from "./closeOut.ts";

/** A lead longer than this ends at a sentence or a word, with an ellipsis. */
export const LEAD_CAP = 400;

const FENCE = /^\s*(?:```|~~~)/;
/** A block that isn't a plain paragraph: a heading, list, table, quote or rule. */
const NOT_PROSE = /^\s*(?:#{1,6}\s|[-*+•]\s|\d{1,2}[.)]\s|\||>|---|\*\*\*|___)/;

/** The reply's blocks outside fenced code, in order. */
function blocks(reply: string): ReadonlyArray<string> {
  let inFence = false;
  const kept: string[] = [];
  for (const line of reply.split("\n")) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      kept.push("");
    } else kept.push(inFence ? "" : line);
  }
  return kept
    .join("\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block !== "");
}

function capped(text: string): string {
  if (text.length <= LEAD_CAP) return text;
  const head = text.slice(0, LEAD_CAP);
  const sentence = head.search(/[.!?](?=\s[^.!?]*$)/);
  if (sentence > LEAD_CAP / 2) return head.slice(0, sentence + 1);
  return `${head.slice(0, head.lastIndexOf(" ")).trimEnd()}…`;
}

/**
 * The reply's opening paragraph, unless `shown` (the words the ask already shows: its quote and
 * steps) has it; null when the reply opens with no paragraph at all.
 */
export function leadOf(reply: string, shown: ReadonlyArray<string>): string | null {
  const first = blocks(readCloseOut(reply).rest).find((block) => !NOT_PROSE.test(block)) ?? null;
  return first === null || shown.join("\n").includes(first) ? null : capped(first);
}
