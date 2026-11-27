// The home's stages under the lists' one motion (`listMotion.ts`, `hops.ts`): as each reading of
// the line comes in, a row new to a stage enters, a Cell on its way learns where it goes, and a
// stage's count holds a Cell until it lands.

import { useLayoutEffect, useRef } from "react";

import type { LineStage, ListReading } from "../line/kit";
import { cellKey } from "../line/line";
import { arrive, type HopStage, inbound, resolveHops, useHops } from "./hops";
import { enteredRows } from "./listMotion";

type Cell = { readonly environmentId: string; readonly id: string; readonly projectId: string };

const STAGES = ["needs", "awake", "asleep"] as const satisfies ReadonlyArray<LineStage>;

export function useLineMotion<C extends Cell>(
  line: Readonly<Record<LineStage, ReadonlyArray<C>>>,
  cells: ReadonlyArray<C>,
  inView: (cell: C) => boolean,
  counts: Readonly<Record<LineStage, number>>,
  /** The machines have sent their Cells: until then no reading is the first. */
  ready: boolean,
  /** What the picks let through: another is the list read again, not rows entering. */
  picks: string,
): Readonly<Record<LineStage, number>> {
  const hops = useHops();
  const before = useRef<Record<LineStage, ListReading> | null>(null);
  const keysIn = (stage: LineStage) => new Set(line[stage].filter(inView).map(cellKey));
  const has = (list: ReadonlyArray<C>, key: string) => list.some((cell) => cellKey(cell) === key);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hand each reading of the line to the hops' store before it paints: the rows that entered a stage, and where the Cells on their way went.
  useLayoutEffect(() => {
    if (!ready) {
      before.current = null;
      return;
    }
    // A machine whose first Cells just came in reads the list again too.
    const machines = [...new Set(cells.map((cell) => cell.environmentId))].sort().join(" ");
    const view = `${picks}|${machines}`;
    const now = {
      needs: { view, keys: keysIn("needs") },
      awake: { view, keys: keysIn("awake") },
      asleep: { view, keys: keysIn("asleep") },
    };
    for (const stage of STAGES)
      arrive(enteredRows(before.current?.[stage] ?? null, view, [...now[stage].keys]), stage);
    before.current = now;
    resolveHops(
      (key, stage) => has(line[stage], key),
      (key) => has(cells, key),
    );
  });
  const held = (stage: HopStage) =>
    counts[stage] - inbound(hops, stage, (key) => has(line[stage].filter(inView), key));
  // No Cell hops into Input: an ask arrives there, and leaves as it's answered.
  return { needs: counts.needs, awake: held("awake"), asleep: held("asleep") };
}
