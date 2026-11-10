/**
 * The marks a Cell earns, in words: each one's name, what shows it, and the sentence that says
 * what it did. One copy for every screen that lists a life's marks
 * (`stemcells/tasks/cell-marks.md`). The rules are `stemcells/ledger/marks.ts`'s; these words
 * only say them.
 */
import type { Award, MarkId } from "../ledger/marks.ts";

const MINUTE = 60_000;

/** "42 min", "2 h", "2 h 14 min": whole minutes, never rounded up to a mark it didn't reach. */
function aloneWords(ms: number): string {
  const minutes = Math.floor(ms / MINUTE);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
}

/** Each mark's name. */
export const MARK_NAMES: Readonly<Record<MarkId, string>> = {
  "landed-alone": "Landed alone",
  merged: "Merged",
  "long-haul": "Long haul",
};

/** What shows a mark, short enough to stand beside its name: "42 min", "#12". */
export function evidenceOf(award: Award): string {
  return award.mark === "merged" ? `#${award.number}` : aloneWords(award.aloneMs);
}

/** What the Cell did, as a sentence. */
export function saidOf(award: Award): string {
  switch (award.mark) {
    case "landed-alone":
      return `Landed with Done after ${aloneWords(award.aloneMs)} on its own, and asked you nothing.`;
    case "merged":
      return `Its pull request #${award.number} merged.`;
    case "long-haul":
      return `Worked ${aloneWords(award.aloneMs)} on its own in this life.`;
  }
}
