// The motion system's move, enter and leave as Reanimated runs them, on the Mac's own numbers
// (`apps/web/src/stemcells/motion/listMotion.ts`).
import { Easing, FadeIn, FadeOut } from "react-native-reanimated";

import { type Bezier, LIST_MOTION } from "../line/kit";

export { enteredRows, LIST_MOTION } from "../line/kit";

const easingOf = (easing: Bezier) => Easing.bezier(...easing);

export const MOVE = {
  duration: LIST_MOTION.move.duration,
  easing: easingOf(LIST_MOTION.move.easing),
};
export const ENTER = {
  duration: LIST_MOTION.enter.duration,
  easing: easingOf(LIST_MOTION.enter.easing),
};
export const LEAVE = {
  duration: LIST_MOTION.leave.duration,
  easing: easingOf(LIST_MOTION.leave.easing),
};

/** Something new fading in where it lands, as a Reanimated entrance. */
export const entering = () => FadeIn.duration(ENTER.duration).easing(ENTER.easing);
/** Something fading out where it stood, as a Reanimated exit. */
export const exiting = () => FadeOut.duration(LEAVE.duration).easing(LEAVE.easing);
