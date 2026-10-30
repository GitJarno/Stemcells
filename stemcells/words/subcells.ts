/**
 * A subagent (or upstream's "agent") is a Subcell to a person: a Cell another Cell starts, and
 * one at work is flying. The web's and phone's substitutes for upstream's sentences say so;
 * views writing it inline in upstream's hot files import it from here, once each; cold ones say
 * it in place (`stemcells/seams.md`, Subcells).
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

/**
 * Upstream's count of a workflow's or a turn's subagents, which it calls agents ("3 agents ·
 * 2 working", "2 of 3 agents working"): Subcells, those at work flying.
 */
export function inSubcellCountWords(count: string): string {
  return inFlyingWords(
    count.replace(
      /\b(\d+) agents?( working)?\b/g,
      (_count, many: string, working: string | undefined) =>
        `${subcellCount(Number(many))}${working === undefined ? "" : " flying"}`,
    ),
  );
}

/** What upstream calls a subagent's background task with no name of its own. */
const UNNAMED_SUBAGENT_TASK = "subagent";

/** A background task's label: an unnamed subagent's is a Subcell; a name of its own stays. */
export const subcellTaskLabel = (label: string): string =>
  label === UNNAMED_SUBAGENT_TASK ? SUBCELL.one : label;

/**
 * Upstream's line about a chat's background work ("Waiting on 2 subagents and 1 command"), its
 * subagents Subcells. A lone task's own name ends the line and stays as it is.
 */
export function subcellWorkTitle(
  title: string,
  items: ReadonlyArray<{ readonly label: string }>,
): string {
  const [only] = items;
  const name =
    items.length === 1 &&
    only !== undefined &&
    only.label !== UNNAMED_SUBAGENT_TASK &&
    title.endsWith(only.label)
      ? only.label
      : "";
  return inSubcellWords(title.slice(0, title.length - name.length)) + name;
}
