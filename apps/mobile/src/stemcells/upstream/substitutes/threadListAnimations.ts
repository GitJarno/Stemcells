// Replaces `features/threads/threadListAnimations.ts` (`substitutes.cjs`): T3's lists move a row
// to its new slot, and close over one that left, on the lists' one move (`home/listMotion.ts`),
// as the Mac's column does; with less motion, at once.
import { LinearTransition, ReduceMotion } from "react-native-reanimated";

import type * as Upstream from "../../../features/threads/threadListAnimations";
import { MOVE } from "../../home/listMotion";

export const THREAD_LIST_ROW_LAYOUT: typeof Upstream.THREAD_LIST_ROW_LAYOUT =
  LinearTransition.duration(MOVE.duration).easing(MOVE.easing).reduceMotion(ReduceMotion.System);
