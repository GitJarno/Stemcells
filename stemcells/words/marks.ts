/**
 * The marks a Cell earns, in words: each one's name, what shows it, and the sentence that says
 * what it did. One copy for every screen that lists a life's marks
 * (`stemcells/tasks/cell-marks.md`). The rules are `stemcells/ledger/marks.ts`'s; these words
 * only say them.
 */
import {
  type Award,
  FREQUENT_FLYER,
  HAT_TRICK,
  LANDED_ALONE_MS,
  LONG_HAUL_MS,
  type MarkId,
  RADIO_SILENCE,
} from "../ledger/marks.ts";

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
  "frequent-flyer": "Frequent flyer",
  "radio-silence": "Radio silence",
  "hat-trick": "Hat-trick",
};

/** What a mark takes, for a Cell that hasn't earned it: short enough to stand beside its name. */
export const MARK_TAKES: Readonly<Record<MarkId, string>> = {
  "landed-alone": `${aloneWords(LANDED_ALONE_MS)} alone in one run, nothing asked`,
  merged: "A pull request merged",
  "long-haul": `${aloneWords(LONG_HAUL_MS)} alone in one life`,
  "frequent-flyer": `${FREQUENT_FLYER} landings`,
  "radio-silence": `${RADIO_SILENCE} landings in a row, nothing asked`,
  "hat-trick": `${HAT_TRICK} pull requests merged`,
};

/** "3 of 6 marks". */
export const marksCount = (earned: number, of: number): string => `${earned} of ${of} marks`;
/** The heading over one Cell's record. */
export const marksOf = (name: string): string => `${name}\u2019s marks`;

/** What shows a mark, short enough to stand beside its name: "42 min", "#12". */
export function evidenceOf(award: Award): string {
  switch (award.mark) {
    case "merged":
      return `#${award.number}`;
    case "frequent-flyer":
      return `${award.landings} landings`;
    case "radio-silence":
      return `${award.inARow} in a row`;
    case "hat-trick":
      return `${award.merges} merged`;
    default:
      return aloneWords(award.aloneMs);
  }
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
    case "frequent-flyer":
      return `Landed ${award.landings} times in this life.`;
    case "radio-silence":
      return `Landed ${award.inARow} times in a row with Done, and asked you nothing.`;
    case "hat-trick":
      return `${award.merges} of its pull requests merged.`;
  }
}
