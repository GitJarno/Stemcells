/**
 * A subagent, in the words a person reads, is a Subcell: a Cell another Cell starts for a
 * piece of its work, and one at work is flying. The web's and phone's substitutes for upstream's
 * sentences about them say so; views that write it inline in upstream's hot files import it
 * from here, once each; cold ones say it in place (`stemcells/seams.md`, Subcells).
 */

/** The word, for the views that write it inline: one, many, and the button that opens one. */
export const SUBCELL = { one: "Subcell", many: "Subcells", open: "Open Subcell" } as const;

/** "1 Subcell", "2 Subcells". */
export const subcellCount = (count: number): string =>
  `${count} ${count === 1 ? SUBCELL.one : SUBCELL.many}`;

/** What upstream calls a subagent with no title of its own. */
export const UNTITLED_SUBAGENT = "Subagent";

/** A sentence upstream builds about subagents, each one a Subcell. */
export function inSubcellWords(sentence: string): string {
  return sentence.replace(
    /\b[Ss]ubagent(s?)\b/g,
    (_subagent, plural: string) => `Subcell${plural}`,
  );
}

/** Upstream's tally of a card's Subcells ("3 working · 1 done"), those at work flying. */
export function inFlyingWords(tally: string): string {
  return tally.replace(/\b(\d+) working\b/g, "$1 flying");
}
