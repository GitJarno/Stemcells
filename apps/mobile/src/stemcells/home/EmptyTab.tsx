// A page of the home that isn't T3's list: a tab with no Cells in it, or the asks of Needs you
// (`line/Asks.tsx`). The header stays, so the other tabs are a tap away, at the same height as
// over T3's list. A reply typed into an ask scrolls clear of the keyboard.

import { use, type ReactNode } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../upstream/cells";
import { NativePrimaryColumnContext } from "../upstream/home";
import { AskiHome } from "./AskiHome";

export function HomePage(props: { readonly filters: ReactNode; readonly children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const primaryColumn = use(NativePrimaryColumnContext);
  return (
    <View className={primaryColumn ? "flex-1 bg-drawer" : "flex-1 bg-screen"}>
      <KeyboardAwareScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 96 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AskiHome />
        {props.filters}
        {props.children}
      </KeyboardAwareScrollView>
    </View>
  );
}

export function EmptyTab(props: { readonly words: string; readonly filters: ReactNode }) {
  return (
    <HomePage filters={props.filters}>
      <AppText className="mt-8 text-center text-base text-foreground-muted">{props.words}</AppText>
    </HomePage>
  );
}
