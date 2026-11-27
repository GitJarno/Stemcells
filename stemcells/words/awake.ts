/**
 * The stages a person reads and the verbs between them (`stemcells/tasks/awake-asleep.md`).
 * Flying, Landed and Input are an awake Cell's own state (`cells.ts`): an ask is answered in
 * its chat (`stemcells/tasks/the-ask.md`), so it is no stage of its own.
 */
import { FLYING } from "./cells.ts";

export const STAGE_WORDS = { awake: "Awake", asleep: "Asleep" } as const;

/** What an awake row's status icon says, to one who can't see it. */
export const STATUS_WORDS = {
  working: FLYING,
  input: "Input",
  approval: "Approval",
  done: "Landed",
} as const;

/** Putting a Cell away, putting it away until a time, and bringing it back. */
export const SLEEP = "Sleep";
export const SLEEP_UNTIL = "Sleep until…";
export const WAKE = "Wake";

export const EMPTY_WORDS = {
  awake: "No Cells awake.",
  asleep: "No Cells asleep.",
} as const;

/** What the undo line says once a Cell, or several, sleeps or wakes. */
export const sleptWords = (who: string) => `${who} is asleep`;
export const sleptManyWords = (count: number) => `${count} Cells asleep`;
export const wokeWords = (who: string) => `${who} is awake`;

/** A timed sleep's row, in place of its time: when it wakes. */
export const wakesWords = (when: string) => `Wakes ${when}`;
