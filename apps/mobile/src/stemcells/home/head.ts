// The home's title row goes up with the list in front, as iOS's large title does
// (stemcells/tasks/home-head.md): how far it has gone and how much of it still shows, kept here
// on the UI thread by the stages (`StagePages.tsx`) for the title in the native header and the
// sky behind it to read.

import { makeMutable, useAnimatedStyle } from "react-native-reanimated";

export const head = { lift: makeMutable(0), shown: makeMutable(1) };

/** The title row's style: as far up as the list has carried it, fading as it passes the bar. */
export function useHeadStyle() {
  return useAnimatedStyle(() => ({
    opacity: head.shown.get(),
    transform: [{ translateY: -head.lift.get() }],
  }));
}
