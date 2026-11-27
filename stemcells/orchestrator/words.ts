// What a Cell is told (stemcells/tasks/aski-orchestrator.md, decision 6): its own pieces of the
// message, word for word, in the person's order. Code cuts only an opening that is provably
// setup ("one Sol agent for …", "Harbor: …"); when unsure it keeps the words.

import { nameWords } from "./names.ts";
import type { Piece } from "./pieces.ts";

/** Words that open an item and say nothing of the task. */
const LEADS = new Set(
  (
    "and then also plus please ok okay so the a an one another other new agent agents cell cells " +
    "first second third fourth fifth sixth seventh eighth ninth tenth next last " +
    "with on at using use in is will be should would effort reasoning thinking " +
    "low medium high xhigh max extra maximum"
  ).split(" "),
);
/** The most words an opening may have before its "for" or ":". */
const LEAD_MOST = 8;

/**
 * `text` without an opening that only sets things up, when it ends in "for" or ":" and every
 * word before that is a lead or one of `heard` (the names the plan read here).
 */
export function withoutLead(text: string, heard: readonly string[]): string {
  const known = new Set(heard.flatMap(nameWords));
  // A list mark is never the task.
  const body = text.replace(/^\s*(?:[-*•]|\d{1,3}[.)])\s+/u, "");
  const match = /^(.*?)(\s+for\s+|\s*:\s+)(\S.*)$/su.exec(body);
  if (!match) return body.trim();
  const [, lead, , rest] = match;
  const words = nameWords(lead!);
  const setup =
    words.length > 0 &&
    words.length <= LEAD_MOST &&
    words.every((word) => LEADS.has(word) || known.has(word) || /^\d{1,2}$/u.test(word));
  // "one for all" keeps its words: what is left must still be a task.
  return setup && rest!.trim().split(/\s+/u).length >= 2 ? rest!.trim() : body.trim();
}

/**
 * The words of the pieces `mine` names, as the person said them: neighbours keep what stood
 * between them, others are set on lines of their own. Each stretch sheds its setup opening.
 */
export function wordsFor(
  text: string,
  pieces: readonly Piece[],
  mine: readonly number[],
  heard: readonly string[],
): string {
  const own = pieces.filter((piece) => mine.includes(piece.n));
  const runs: string[] = [];
  let from: Piece | null = null;
  let last: Piece | null = null;
  const close = () => {
    // A comma left hanging where the next item was cut off, with its "and", says nothing.
    if (from && last)
      runs.push(
        withoutLead(text.slice(from.start, last.end), heard).replace(
          /\s*,(?:\s*(?:and|then))?\s*$/iu,
          "",
        ),
      );
  };
  for (const piece of own) {
    if (last && piece.n === last.n + 1) {
      last = piece;
      continue;
    }
    close();
    from = piece;
    last = piece;
  }
  close();
  return runs.filter((run) => run.length > 0).join("\n");
}
