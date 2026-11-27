// A page of the home that isn't T3's list: a stage with no Cells in it (`line/LineHome.tsx`), and
// on Input after a clearing, a short fact under its line. Its top rests where T3's list's does on
// iOS, under its stage's top (`StagePill.tsx`).

import type { ReactNode } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../upstream/cells";
import { useHomeSidebar, useWorkspaceTabs } from "../upstream/home";
import { NativeScrollViewMarker } from "../upstream/substitutes/NativeScrollViewMarker";
import { PlannedRows } from "./PlannedRows";
import { StageTop } from "./StagePill";

function HomePage(props: { readonly children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const workspace = useWorkspaceTabs();
  const sidebar = useHomeSidebar();
  return (
    <View className={sidebar ? "flex-1 bg-drawer" : "flex-1 bg-screen"}>
      <NativeScrollViewMarker style={{ flex: 1 }}>
        <KeyboardAwareScrollView
          // The marker's own child, so the header finds it: the default mode puts a view between.
          mode="layout"
          // UIKit adds no inset to a stage's list (the marker's substitute): the foot holds the
          // safe area itself, as T3's list's does.
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 24, workspace?.bottomClearance ?? 0),
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StageTop />
          <PlannedRows />
          {props.children}
        </KeyboardAwareScrollView>
      </NativeScrollViewMarker>
    </View>
  );
}

/** `words` null: Awake with only the rows Aski's plan is about to start (`PlannedRows.tsx`), which say it themselves. */
export function EmptyTab(props: { readonly words: string | null; readonly fact?: string }) {
  if (props.words === null) return <HomePage>{null}</HomePage>;
  return (
    <HomePage>
      <AppText className="mt-8 text-center text-base text-foreground-muted">{props.words}</AppText>
      {props.fact === undefined ? null : (
        <AppText className="mx-8 mt-3 text-center text-sm text-foreground-muted">
          {props.fact}
        </AppText>
      )}
    </HomePage>
  );
}
