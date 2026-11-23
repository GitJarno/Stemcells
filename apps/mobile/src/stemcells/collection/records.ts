// The marks the Cells shown earned in their own lives, as the Mac reads them
// (`apps/web/src/stemcells/collection/records.ts`): asked of the Cells' own machine as the
// screen lists them, and again when something lands or merges.

import { useEffect, useState } from "react";

import { askMachine, type MachineConnection } from "../upstream/machines";
import type { Award, CellRecords } from "./kit";

const NONE: ReadonlyMap<string, readonly Award[]> = new Map();

/**
 * Each of `threadIds`' marks, by thread id; `stamp` changes when they may have. None until the
 * machine answers, and what it said last while it is asked again.
 */
export function useRecords(
  connection: MachineConnection | null,
  threadIds: readonly string[],
  stamp: number,
): ReadonlyMap<string, readonly Award[]> {
  const asked = threadIds.join(",");
  // One key for the effect: the Cells asked for, and the stamp that asks again.
  const again = `${stamp}:${asked}`;
  const machine = connection?.reach === "direct" ? connection.environmentId : null;
  const [read, setRead] = useState<{
    readonly asked: string;
    readonly marks: ReadonlyMap<string, readonly Award[]>;
  } | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Fetch the Cells' records as the screen lists them and when a landing or a merge may have added one, dropping an answer that arrives after the list changed.
  useEffect(() => {
    const threads = again.slice(again.indexOf(":") + 1);
    if (threads === "" || machine === null) return;
    let cancelled = false;
    void askMachine(
      machine,
      `/api/stemcells/collection/cells?threads=${encodeURIComponent(threads)}`,
    )
      .then(async (answer) => (answer?.ok ? ((await answer.json()) as CellRecords) : null))
      .catch(() => null)
      .then((records) => {
        if (!cancelled && records !== null)
          setRead({ asked: threads, marks: new Map(Object.entries(records.marks)) });
      });
    return () => {
      cancelled = true;
    };
  }, [again, machine]);
  return read === null || read.asked !== asked ? NONE : read.marks;
}
