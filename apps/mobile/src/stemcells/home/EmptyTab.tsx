// A page of the home that isn't T3's list: a tab with no Cells in it, or the asks of Input
// (`line/LineHome.tsx`). Its top rests where T3's list's does on iOS, under Aski's room
// (`AskiHome.tsx`). A reply typed into an ask scrolls clear of the keyboard.

import { use, type ReactNode } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../upstream/cells";
import { NativePrimaryColumnContext, useWorkspaceTabs } from "../upstream/home";
import { NativeScrollViewMarker } from "../upstream/substitutes/NativeScrollViewMarker";
import { HeaderSpace } from "./AskiHome";

export function HomePage(props: { readonly children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const workspace = useWorkspaceTabs();
  const primaryColumn = use(NativePrimaryColumnContext);
  return (
    <View className={primaryColumn ? "flex-1 bg-drawer" : "flex-1 bg-screen"}>
      <NativeScrollViewMarker style={{ flex: 1 }}>
        <KeyboardAwareScrollView
          // The marker's own child, so the header finds it: the default mode puts a view between.
          mode="layout"
          // UIKit's inset, which the marker sets on every stage's list, holds the safe area.
          contentContainerStyle={{
            paddingBottom:
              Math.max(insets.bottom, 24, workspace?.bottomClearance ?? 0) - insets.bottom,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <HeaderSpace />
          {props.children}
        </KeyboardAwareScrollView>
      </NativeScrollViewMarker>
    </View>
  );
}

export function EmptyTab(props: { readonly words: string }) {
  return (
    <HomePage>
      <AppText className="mt-8 text-center text-base text-foreground-muted">{props.words}</AppText>
    </HomePage>
  );
}
