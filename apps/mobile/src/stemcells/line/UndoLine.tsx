// The undo line at the list's foot (`takeBack.ts`), in T3's own notice: what you did, with Undo;
// swiped away, it goes now. One line stands at a time, so T3's notice lets ours go, and ours
// takes the place of T3's.

import { useEffect } from "react";
import Animated from "react-native-reanimated";

import { useOverKeyboard } from "../home/overKeyboard";
import { usePillFoot } from "../home/pillPlace";
import { dismissThreadUndoNotice, Toast, useShownThreadUndoNotice } from "../upstream/needs";
import { letGo, undo, useTakeBack } from "./takeBack";

export function UndoLine() {
  const line = useTakeBack();
  const notice = useShownThreadUndoNotice();
  // Where T3's own notice stands, over the stages' pill (`home/StagePill.tsx`).
  const { place, style } = useOverKeyboard(usePillFoot());
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Keep one undo line: T3's notice lets ours go.
  useEffect(() => {
    if (notice !== null) letGo();
  }, [notice]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Keep one undo line: an act's line takes the place of T3's notice.
  useEffect(() => {
    if (line !== null) dismissThreadUndoNotice();
  }, [line]);
  if (line === null) return null;
  return (
    <Animated.View
      collapsable={false}
      className="absolute z-[100]"
      style={[{ left: place.left, right: place.right }, style]}
      pointerEvents="box-none"
    >
      <Toast
        key={line.key}
        message={line.words}
        singleLine
        action={{ label: "Undo", onPress: undo }}
        dismissMode="swipe"
        onDismiss={letGo}
      />
    </Animated.View>
  );
}
