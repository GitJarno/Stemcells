import { useNavigation } from "@react-navigation/native";
import { useRef } from "react";
import { type LayoutChangeEvent, Platform } from "react-native";

/**
 * The sheet the pick opens in fits its content on iOS (`stemcells/tasks/model-pick.md`), where
 * T3's catalog took the whole screen; Android keeps T3's pushed page.
 */
export function pickSheet<Options extends object>(options: Options): Options {
  if (Platform.OS !== "ios") return options;
  return { ...options, sheetAllowedDetents: "fitToContents" };
}

/**
 * Sizes `pickSheet`'s sheet. A fit-to-contents sheet takes the height of its content, but T3's
 * stack draws a presented route inside a nested stack that only fills its parent, so that content
 * measures 0 and the sheet opened large and empty. The pick measures itself and hands the route
 * its height; the catalog asks for the whole sheet.
 */
export function useSheetFit() {
  const navigation = useNavigation();
  const last = useRef<number | "whole" | null>(null);
  const apply = (next: number | "whole", options: object) => {
    if (Platform.OS !== "ios" || last.current === next) return;
    last.current = next;
    navigation.setOptions(options);
  };
  return {
    onLayout: (event: LayoutChangeEvent) => {
      const height = Math.ceil(event.nativeEvent.layout.height);
      apply(height, { contentStyle: { height } });
    },
    whole: () => apply("whole", { sheetAllowedDetents: [1], contentStyle: undefined }),
  };
}
