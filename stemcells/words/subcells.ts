/**
 * A subagent, in the words a person reads, is a Subcell: a Cell another Cell
 * starts for a piece of its work. Upstream names them in a few sentences it
 * builds (a turn's "Launched 2 subagents", the title of one with none of its
 * own, "Subagent of" over its thread); the web's and the phone's substitutes
 * for those modules say Subcell instead. The views that write the word
 * inline in upstream's hot files import it from here, once each; cold ones
 * say it in place (`stemcells/seams.md`, Subcells).
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
