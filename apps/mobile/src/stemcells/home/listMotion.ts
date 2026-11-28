// The motion system's move, enter and leave as Reanimated runs them, on the Mac's own numbers
// (`apps/web/src/stemcells/motion/listMotion.ts`).
import { Easing, FadeIn, FadeOut, makeMutable } from "react-native-reanimated";

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
/** Asleep's catch: the count gives under a leaping Cell's landing, then its spring hands it back. */
export const CATCH_GIVE = {
  duration: LIST_MOTION.catch.give,
  easing: Easing.out(Easing.sin),
};
/** The spring at unit mass (`springAt`'s), still once its swing is a hundredth. */
export const CATCH_RETURN = {
  stiffness: ((2 * Math.PI) / LIST_MOTION.catch.response) ** 2,
  damping: (2 * LIST_MOTION.catch.damping * 2 * Math.PI) / LIST_MOTION.catch.response,
  mass: 1,
  energyThreshold: 1e-4,
};

/** Something new fading in where it lands, as a Reanimated entrance. */
export const entering = () => FadeIn.duration(ENTER.duration).easing(ENTER.easing);
/** Something fading out where it stood, as a Reanimated exit. */
export const exiting = () => FadeOut.duration(LEAVE.duration).easing(LEAVE.easing);

/**
 * While a planned row is handed to T3's list where it stands (`PlannedRows.tsx`), the list's rows
 * take their new slots at once: the header gives the same room back in that draw, so nothing moves.
 */
export const rowsStandStill = makeMutable(false);
