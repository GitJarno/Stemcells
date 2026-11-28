// The line of Cells the server starts itself (stemcells/tasks/aski-orchestrator.md, decisions 16
// and 17): a Cell that comes after others starts when each of them has landed with nothing left
// for the person, and one that only needs a worktree starts at once. Pure: what is due, from
// the book and how the Cells stand.

import type { StartAct } from "../../../../../stemcells/orchestrator/plan.ts";
import type { BookEntry, Launch, Standing } from "./book.ts";

/** How long a Cell stays queued before it is dropped: a chain no one looks at ends. */
export const QUEUED_MOST_MS = 24 * 60 * 60_000;

export type Due =
  | {
      readonly kind: "start";
      readonly id: string;
      readonly act: StartAct;
      readonly launch: Launch;
      /** The Cells it came after, in the plan's order. */
      readonly before: ReadonlyArray<StartAct>;
    }
  | { readonly kind: "expire"; readonly id: string; readonly i: number };

/** A Cell landed with nothing left: done, and not stopped, failed, rolled back or left waiting. */
const landedWell = (standing: Standing | null): boolean =>
  standing !== null && standing.stage === "done" && standing.landing?.verdict !== "short";

/** What the line does now: the queued Cells to start, and those that waited too long. */
export function dueOf(
  entries: ReadonlyArray<BookEntry>,
  standingOf: (threadId: string) => Standing | null,
  now: number,
): Due[] {
  const due: Due[] = [];
  for (const entry of entries) {
    const statusOf = (i: number) => entry.outcome?.find((one) => one.i === i)?.status;
    for (const [key, launch] of Object.entries(entry.launches ?? {})) {
      const i = Number(key);
      const act = entry.plan.acts.find((one) => one.i === i);
      if (act === undefined || act.kind !== "start" || statusOf(i) !== "queued") continue;
      if (now - launch.at > QUEUED_MOST_MS) {
        due.push({ kind: "expire", id: entry.plan.id, i });
        continue;
      }
      const before = (act.after ?? []).map((n) => entry.plan.acts.find((one) => one.i === n));
      const ready = before.every(
        (one) =>
          one !== undefined &&
          one.kind === "start" &&
          statusOf(one.i) === "started" &&
          landedWell(standingOf(one.threadId)),
      );
      if (ready)
        due.push({
          kind: "start",
          id: entry.plan.id,
          act,
          launch,
          before: before.filter((one): one is StartAct => one?.kind === "start"),
        });
    }
  }
  return due;
}
