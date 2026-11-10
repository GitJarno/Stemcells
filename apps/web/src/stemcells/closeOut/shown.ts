/**
 * What stands under a Cell's own word on its latest reply: how it landed and what its run shows,
 * as Aski's room says them (`needs/boardRows.ts`, `needs/facts.ts`). Pure.
 */
import { VERDICTS } from "../needs/boardRows";
import { barOf, changedWords, factsOf, type BarCell, type Fact } from "../needs/facts";
import type { CellStanding, Landing } from "../needs/wire";

export interface Shown {
  readonly verdict: {
    readonly is: Landing["verdict"];
    readonly mark: string;
    readonly name: string;
  } | null;
  readonly changed: { readonly bar: ReadonlyArray<BarCell>; readonly words: string } | null;
  readonly facts: ReadonlyArray<Fact>;
}

/** Null when the server sent nothing to show: an older server, or a run that left no record. */
export function shownOf(standing: CellStanding | null | undefined): Shown | null {
  if (standing == null) return null;
  const landing = standing.landing ?? null;
  const brief = standing.brief ?? null;
  const changed =
    brief?.changed == null
      ? null
      : { bar: barOf(brief.changed), words: changedWords(brief.changed) };
  const facts = factsOf(brief);
  if (landing === null && changed === null && facts.length === 0) return null;
  return {
    verdict: landing === null ? null : { is: landing.verdict, ...VERDICTS[landing.verdict] },
    changed,
    facts,
  };
}
