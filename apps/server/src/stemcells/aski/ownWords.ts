// Whether a message Aski sends a Cell is the person's own (stemcells/tasks/aski-orchestrator.md,
// principle 5 and decision 7). Aski reads every project and whatever a page or a Cell wrote, so
// what it passes on is checked by code: runs of words copied from a message the person wrote
// in Aski's chat, in their order. A sentence nobody said can't reach a Cell through Aski.

/** A message's words as compared: case folded, an apostrophe kept inside its word. */
const wordsOf = (text: string): string[] =>
  text
    .toLowerCase()
    .replaceAll("’", "'")
    .match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) ?? [];

/** Words that turn a sentence round: a run that starts just after one left it out. */
const TURNS = new Set([
  "not", "never", "no", "don't", "dont", "doesn't", "didn't", "won't", "can't", "cannot",
  "shouldn't", "mustn't", "isn't", "aren't", "without", "stop", "unless", "except", "nor",
]);

/** The most runs a sent message may be cut into: a target's name left out, twice. */
const MOST_RUNS = 3;

/** Whether `sent` is made of at most three runs of `source`'s words, in order, none after a dropped "not". */
export function quotes(sent: string, source: string): boolean {
  const want = wordsOf(sent);
  const have = wordsOf(source);
  if (want.length === 0) return false;
  let at = 0;
  let from = 0;
  let runs = 0;
  let single = 0;
  while (at < want.length) {
    let best = -1;
    let length = 0;
    for (let start = from; start < have.length; start++) {
      let size = 0;
      while (at + size < want.length && have[start + size] === want[at + size]) size++;
      if (size > length) [best, length] = [start, size];
    }
    if (length === 0) return false;
    // "don't delete the branch" must not go on as "delete the branch".
    if (best > from && TURNS.has(have[best - 1]!)) return false;
    runs++;
    if (length === 1) single++;
    at += length;
    from = best + length;
  }
  // A word alone is a pick, not a quote: one may stand among the runs, no more.
  return runs <= MOST_RUNS && (single <= 1 || want.length <= 2);
}

/** Whether the person said `sent` in one of `sources`, their own latest messages. */
export const saidByThePerson = (sent: string, sources: readonly string[]): boolean =>
  sources.some((source) => quotes(sent, source));
