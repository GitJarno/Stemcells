// The marks the Cells shown earned in their own lives (`GET /api/stemcells/collection/cells`),
// read as the wardrobe shows them and again when something lands or merges.

import { useEffect, useState } from "react";

import type { Award, CellRecords } from "../../../../../stemcells/ledger/marks.ts";
import { getFromPrimary } from "../upstream/disk";

const NONE: ReadonlyMap<string, readonly Award[]> = new Map();

/**
 * Each of `threadIds`' marks, by thread id; `stamp` changes when they may have. None until the
 * machine answers, and what it said last while it is asked again.
 */
export function useRecords(
  threadIds: readonly string[],
  stamp: number,
): ReadonlyMap<string, readonly Award[]> {
  const asked = threadIds.join(",");
  // One key for the effect: the Cells asked for, and the stamp that asks again.
  const again = `${stamp}:${asked}`;
  const [read, setRead] = useState<{
    readonly asked: string;
    readonly marks: ReadonlyMap<string, readonly Award[]>;
  } | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Fetch the Cells' records as the wardrobe lists them and when a landing or a merge may have added one, dropping an answer that arrives after the list changed.
  useEffect(() => {
    const threads = again.slice(again.indexOf(":") + 1);
    if (threads === "") return;
    let cancelled = false;
    void getFromPrimary("/api/stemcells/collection/cells", { threads })
      .then(async (response) => (response.ok ? ((await response.json()) as CellRecords) : null))
      .catch(() => null)
      .then((records) => {
        if (!cancelled && records !== null)
          setRead({ asked: threads, marks: new Map(Object.entries(records.marks)) });
      });
    return () => {
      cancelled = true;
    };
  }, [again]);
  return read === null || read.asked !== asked ? NONE : read.marks;
}
