// How far night has fallen over the home's header, kept here: each tab's page mounts the header
// again (`AskiHome.tsx`), so a tab change turns the night from wherever it stands, on the UI
// thread (`nightfall.ts`). The first home to show takes the night as it stands, unanimated.

import { useLayoutEffect, useSyncExternalStore } from "react";
import {
  Easing,
  makeMutable,
  useReducedMotion,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { runOnUISync, scheduleOnRN, scheduleOnUI } from "react-native-worklets";

import { easeOut, NIGHTFALL_MS, NOTICE_MS, SLOW_BLINK, turn } from "./nightfall";

/** What the header draws: the day, a turn either way, or the night standing. */
type Dusk = "day" | "turning" | "night";

/** 0 day to 1 night. */
export const fallen = makeMutable(0);
/** How far Aski's eyes are shut in its slow blink as the night settles, 0 to 1. */
export const noticing = makeMutable(0);

/** Where the night is headed: null until a home has shown. */
let heading: boolean | null = null;
let dusk: Dusk = "day";
const listeners = new Set<() => void>();

function setDusk(next: Dusk) {
  if (dusk === next) return;
  dusk = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** A turn ends: the night stands, unless a later turn has taken it since. */
function settle(night: boolean) {
  if (heading === night) setDusk(night ? "night" : "day");
}

function fall(night: boolean, reduced: boolean) {
  "worklet";
  const at = fallen.get();
  const step = turn(at, night, reduced);
  if (step === null) {
    fallen.set(at);
    scheduleOnRN(settle, night);
    return;
  }
  const easing = step.eased ? easeOut : Easing.linear;
  const done = (finished?: boolean) => {
    "worklet";
    if (finished) scheduleOnRN(settle, night);
  };
  if (!step.notices) {
    fallen.set(withTiming(step.to, { duration: step.ms, easing }, done));
    return;
  }
  const notice = NOTICE_MS / NIGHTFALL_MS;
  fallen.set(
    withSequence(
      withTiming(notice, { duration: NOTICE_MS - at * NIGHTFALL_MS, easing }, (finished) => {
        "worklet";
        if (!finished) return;
        noticing.set(
          withSequence(
            withTiming(1, { duration: SLOW_BLINK.close }),
            withDelay(SLOW_BLINK.hold, withTiming(0, { duration: SLOW_BLINK.open })),
          ),
        );
      }),
      withTiming(1, { duration: NIGHTFALL_MS - NOTICE_MS, easing }, done),
    ),
  );
}

function head(night: boolean, reduced: boolean) {
  if (heading === night) return;
  if (heading === null) {
    heading = night;
    // At once, so the views mounting next read the standing night from their first frame.
    if (night)
      runOnUISync(() => {
        "worklet";
        fallen.set(1);
      });
    setDusk(night ? "night" : "day");
    return;
  }
  heading = night;
  setDusk("turning");
  scheduleOnUI(fall, night, reduced);
}

/** The night over a home showing `night` (null off the home's tabs), turning it there. */
export function useNight(night: boolean | null): Dusk {
  const reduced = useReducedMotion();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Turn the night every mount of the header shares toward this tab's, before the mount's first frame paints.
  useLayoutEffect(() => {
    if (night !== null) head(night, reduced);
  }, [night, reduced]);
  return useSyncExternalStore(subscribe, () => (night === null ? "day" : dusk));
}
