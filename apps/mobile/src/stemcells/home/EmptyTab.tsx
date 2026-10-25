// A tab with no Cells in it: the header stays, so the other tabs are a tap
// away, and a line says the tab is empty. It stands where T3's list would,
// its header at the same height.

import { use, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../upstream/cells";
import { NativePrimaryColumnContext } from "../upstream/home";
import { AskiHome } from "./AskiHome";
import type { HomeTab } from "./tabs";

const EMPTY: Readonly<Record<HomeTab, string>> = {
  asleep: "No Cells asleep.",
  active: "No Cells awake.",
  working: "No Cells working.",
  input: "Nothing waits on you.",
};

export function EmptyTab(props: { readonly tab: HomeTab; readonly filters: ReactNode }) {
  const insets = useSafeAreaInsets();
  const primaryColumn = use(NativePrimaryColumnContext);
  return (
    <View className={primaryColumn ? "flex-1 bg-drawer" : "flex-1 bg-screen"}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
      >
        <AskiHome />
        {props.filters}
        <AppText className="mt-8 text-center text-base text-foreground-muted">
          {EMPTY[props.tab]}
        </AppText>
      </ScrollView>
    </View>
  );
}
