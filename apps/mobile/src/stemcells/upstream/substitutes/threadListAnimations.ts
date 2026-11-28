// Replaces `features/threads/threadListAnimations.ts` (`substitutes.cjs`): T3's lists move a row
// to its new slot, and close over one that left, on the lists' one move (`home/listMotion.ts`),
// as the Mac's column does; with less motion, at once. And at once while a planned row is handed
// to the list where it stands (`rowsStandStill`).
import { LinearTransition, ReduceMotion, withTiming } from "react-native-reanimated";

import type * as Upstream from "../../../features/threads/threadListAnimations";
import { MOVE, rowsStandStill } from "../../home/listMotion";
import { onHanding } from "../../home/plannedArrivals";

onHanding((on) => rowsStandStill.set(on));

const layout = LinearTransition.duration(MOVE.duration)
  .easing(MOVE.easing)
  .reduceMotion(ReduceMotion.System);
const move = layout.build();
const AT_ONCE = { duration: 0 };
layout.build = () => (values) => {
  "worklet";
  if (!rowsStandStill.get()) return move(values);
  return {
    initialValues: {
      originX: values.targetOriginX,
      originY: values.targetOriginY,
      width: values.targetWidth,
      height: values.targetHeight,
    },
    animations: {
      originX: withTiming(values.targetOriginX, AT_ONCE),
      originY: withTiming(values.targetOriginY, AT_ONCE),
      width: withTiming(values.targetWidth, AT_ONCE),
      height: withTiming(values.targetHeight, AT_ONCE),
    },
  };
};

export const THREAD_LIST_ROW_LAYOUT: typeof Upstream.THREAD_LIST_ROW_LAYOUT = layout;
