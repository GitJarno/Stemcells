// The undo line at the list's foot (stemcells/tasks/phone-line.md, decision 4), in T3's own
// notice: what you did, with Undo; swiped away, it goes now. One line stands at a time, so
// T3's notice for a settle or a snooze lets a held answer go, and an answer's line takes the
// place of T3's.

import { useEffect, useSyncExternalStore } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  dismissThreadUndoNotice,
  Toast,
  useThreadUndoNotice,
  useWorkspaceTabs,
} from "../upstream/needs";
import type { HeldStore } from "./held";

export function UndoLine(props: { readonly held: HeldStore }) {
  const { held } = props;
  const { line } = useSyncExternalStore(held.subscribe, held.read);
  const notice = useThreadUndoNotice();
  const insets = useSafeAreaInsets();
  const workspace = useWorkspaceTabs();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Keep one undo line: T3's notice lets ours go.
  useEffect(() => {
    if (notice !== null) void held.letGo();
  }, [notice, held]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Keep one undo line: an act's line takes the place of T3's notice.
  useEffect(() => {
    if (line !== null && line.kind !== "said") dismissThreadUndoNotice();
  }, [line]);
  if (line === null) return null;
  // Where T3's own notice stands over the home's search bar.
  const bottom = Math.max(insets.bottom, (workspace?.bottomClearance ?? 0) - 32) + 8;
  return (
    <View
      collapsable={false}
      className="absolute z-[100]"
      style={{ bottom, left: 29, right: 23 }}
      pointerEvents="box-none"
    >
      {line.kind !== "said" ? (
        <Toast
          key={line.kind === "held" ? line.act.key : line.key}
          message={line.kind === "held" ? line.act.words : line.words}
          singleLine
          action={{ label: "Undo", onPress: held.undo }}
          dismissMode="swipe"
          onDismiss={() => void held.letGo()}
        />
      ) : (
        <Toast message={line.words} dismissMode="swipe" onDismiss={() => void held.letGo()} />
      )}
    </View>
  );
}
