// A row on the home's stages hands its Cell over as T3 starts to dismiss it for a move
// (`hops.ts`): the Cell lifts out of `figure` and flies to its count. With less motion it stays
// in its row, and the count only ticks.

import { use, useLayoutEffect, type RefObject } from "react";
import type { ViewInstance } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { cellKey } from "../line/line";
import type { EnvironmentThreadShell } from "../upstream/cells";
import { registerThreadDismissal } from "../upstream/home";
import { departs } from "./hops";
import { awakeRows, HomeInFront, HomeStageContext } from "./state";

export function useDeparture(
  thread: EnvironmentThreadShell,
  figure: RefObject<ViewInstance | null>,
  enabled: boolean,
) {
  const stage = use(HomeStageContext);
  const inFront = use(HomeInFront);
  const reduced = useReducedMotion();
  const key = cellKey(thread);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Register with T3's dismissals for this row's chat while the row stands on a stage in sight.
  useLayoutEffect(() => {
    if (!enabled || reduced || !inFront || (!awakeRows(stage) && stage !== "asleep")) return;
    // An asking Cell slept from Input leaves Awake too: it flies from there.
    const from = stage === "asleep" ? "asleep" : "awake";
    return registerThreadDismissal(key, () => {
      const view = figure.current;
      return {
        finished: Promise.resolve(),
        restore: view === null ? () => undefined : departs(key, thread, from, view),
      };
    });
  }, [enabled, inFront, stage, key, thread, reduced, figure]);
}
