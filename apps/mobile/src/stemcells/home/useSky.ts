// How far night has fallen over the home's header, 0 day to 1 night with dawn between, kept here
// so every mount of the home turns the one sky from wherever it stands, on the UI thread
// (`motion/sky.ts`).

import { Easing, makeMutable, withTiming } from "react-native-reanimated";
import { runOnUISync, scheduleOnUI } from "react-native-worklets";

import { SKY_AT, SKY_TURN, skyTurn } from "../line/kit";

export const fallen = makeMutable(0);

/** Where the sky is headed: null until a home has shown. */
let heading: number | null = null;

function fall(to: number, reduced: boolean, rise: boolean) {
  "worklet";
  const step = skyTurn(fallen.get(), to, reduced, rise);
  if (step === null) return;
  const easing = step.eased ? Easing.bezier(...SKY_TURN.easing) : Easing.linear;
  // Replaces a turn running: nothing queues, and it sets off from where the sky stands.
  fallen.set(withTiming(step.to, { duration: step.ms, easing }));
}

/**
 * Turns the sky to `to` (`SKY_AT`, or a stage's by `skyOver`). The first home to show takes it
 * as it stands, unanimated.
 */
export function turnSky(to: number, reduced: boolean, rise = false) {
  if (heading === to) return;
  const first = heading === null;
  heading = to;
  if (first)
    // At once, so the views mounting next read the standing sky from their first frame.
    runOnUISync(() => {
      "worklet";
      fallen.set(to);
    });
  else scheduleOnUI(fall, to, reduced, rise);
}

/** The last ask answered: dawn rises slowly into day, whatever stage the home then shows. */
export function riseSky(reduced: boolean) {
  turnSky(SKY_AT.day, reduced, true);
}
