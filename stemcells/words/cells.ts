/**
 * A thread is a Cell to a person, and one at work is flying (`stemcells/AGENTS.md`, Words). The
 * builds say so in every message upstream's views show (`stemcells/brand/cellWords.ts`).
 */
export const CELL = { one: "Cell", many: "Cells" } as const;

/**
 * `text` with Cell for each thread in it: how a build prints a sentence upstream wrote in a
 * message, for our code that knows one by its words, and for sentences upstream builds at runtime.
 */
export function asBuilt(text: string): string {
  return text.replace(/\b(?:T3 )?[Tt]hread(s?)\b/g, (_thread, many: string) =>
    many === "" ? CELL.one : CELL.many,
  );
}

/** What upstream's "Working" reads as, where a Cell is at work. */
export const FLYING = "Flying";
