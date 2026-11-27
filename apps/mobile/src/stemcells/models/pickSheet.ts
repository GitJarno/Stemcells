import { Platform } from "react-native";

/**
 * The sheet the pick opens in fits its content on iOS (`stemcells/tasks/model-pick.md`), where
 * T3's catalog took the whole screen; Android keeps T3's pushed page.
 */
export function pickSheet<Options extends object>(options: Options): Options {
  if (Platform.OS !== "ios") return options;
  return { ...options, sheetAllowedDetents: "fitToContents" };
}
