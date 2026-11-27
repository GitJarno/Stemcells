// The home's stages under the lists' one motion (`listMotion.ts`, `hops.ts`): as each reading of
// the line comes in, a row new to a stage enters, a Cell on its way to a stage learns where it
// goes, and a stage's count holds a Cell until it lands.

import { useLayoutEffect, useRef } from "react";

import type { LineStage } from "../line/kit";
import { cellKey } from "../line/line";
import { arrive, type HopStage, inbound, resolveHops, useHops } from "./hops";
import { enteredRows } from "./listMotion";

type Cell = { readonly environmentId: string; readonly id: string; readonly projectId: string };

const STAGES = ["awake", "asleep"] as const satisfies ReadonlyArray<HopStage>;

export function useLineMotion<C extends Cell>(
  line: Readonly<Record<LineStage, ReadonlyArray<C>>>,
  cells: ReadonlyArray<C>,
  inView: (cell: C) => boolean,
  counts: Readonly<Record<LineStage, number>>,
): Readonly<Record<LineStage, number>> {
  const hops = useHops();
  const before = useRef<Record<HopStage, ReadonlySet<string>> | null>(null);
  const keysIn = (stage: HopStage) => new Set(line[stage].filter(inView).map(cellKey));
  const has = (list: ReadonlyArray<C>, key: string) => list.some((cell) => cellKey(cell) === key);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hand each reading of the line to the hops' store before it paints: the rows that entered a stage, and where the Cells on their way went.
  useLayoutEffect(() => {
    const now = { awake: keysIn("awake"), asleep: keysIn("asleep") };
    for (const stage of STAGES)
      arrive(enteredRows(before.current?.[stage] ?? null, [...now[stage]]), stage);
    before.current = now;
    resolveHops(
      (key, stage) => has(line[stage], key),
      (key) => has(cells, key),
    );
  });
  const held = (stage: HopStage) =>
    counts[stage] - inbound(hops, stage, (key) => has(line[stage].filter(inView), key));
  return { awake: held("awake"), asleep: held("asleep") };
}
