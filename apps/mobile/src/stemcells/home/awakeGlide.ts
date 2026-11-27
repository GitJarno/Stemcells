// Awake's list making room for a planned row, or closing over one that left (`PlannedRows.tsx`):
// the list is laid out at once and glides from where it stood, the lists' move, on the UI thread.

import { makeMutable, runOnUI, useAnimatedStyle, withTiming } from "react-native-reanimated";

import { MOVE } from "./listMotion";

const shift = makeMutable(0);

/** Awake's rows were just laid out `by` points lower (higher, negative): they glide there from where they stood, from wherever a glide under way has them. */
export function glideBy(by: number): void {
  runOnUI(() => {
    "worklet";
    shift.value = shift.value - by;
    shift.value = withTiming(0, MOVE);
  })();
}

/** The style of what holds Awake's list. */
export function useAwakeGlide() {
  return useAnimatedStyle(() => ({ transform: [{ translateY: shift.get() }] }));
}
