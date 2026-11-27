// Replaces `features/home/ThreadUndoNotice.tsx` (`substitutes.cjs`): while the stages' pill stands
// where T3's notice would (`home/StagePill.tsx`), the notice stands over the pill. A Sleep or a
// Snooze shows none (`upstream/needs.ts`, `useShownThreadUndoNotice`).
import { StyleSheet, View } from "react-native";

import * as Upstream from "../../../features/home/ThreadUndoNotice";
import { useNoticeLift } from "../../home/state";
import { useShownThreadUndoNotice } from "../needs";

export * from "../../../features/home/ThreadUndoNotice";

export function ThreadUndoNotice(
  props: Parameters<typeof Upstream.ThreadUndoNotice>[0],
): ReturnType<typeof Upstream.ThreadUndoNotice> {
  const lift = useNoticeLift();
  const shown = useShownThreadUndoNotice() !== null;
  return (
    // One view either way, so the notice doesn't mount again as the pill comes and goes.
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { zIndex: 100, transform: [{ translateY: -lift }] }]}
    >
      <Upstream.ThreadUndoNotice {...props} visible={props.visible && shown} />
    </View>
  );
}
