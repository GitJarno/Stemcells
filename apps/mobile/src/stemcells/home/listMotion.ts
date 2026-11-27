// The lists' one motion (move, enter, leave) as Reanimated runs it, on the Mac's own numbers
// (`apps/web/src/stemcells/motion/listMotion.ts`).
import { Easing } from "react-native-reanimated";

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
