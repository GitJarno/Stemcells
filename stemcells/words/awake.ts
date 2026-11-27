/**
 * The stages a person reads and the verbs between them (`stemcells/tasks/awake-asleep.md`).
 * Flying and Landed are an awake Cell's own state (`cells.ts`); Input lists the awake Cells that
 * ask, longest waiting first (`stemcells/tasks/inbox.md`).
 */
import { FLYING } from "./cells.ts";

export const STAGE_WORDS = { needs: "Input", awake: "Awake", asleep: "Asleep" } as const;

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
  needs: "Nothing needs you.",
  awake: "No Cells awake.",
  asleep: "No Cells asleep.",
} as const;

/** A timed sleep's row, in place of its time: when it wakes. */
export const wakesWords = (when: string) => `Wakes ${when}`;
