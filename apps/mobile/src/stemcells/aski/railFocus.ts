// Navigation's focus for the rail's store (`rail.ts`), handed to it once by `pages.tsx`.

import { NavigationContext } from "@react-navigation/native";
import { use, useSyncExternalStore } from "react";

/** Whether the screen this runs in has navigation's focus; true outside a navigator's screen. */
export function useScreenFocused(): boolean {
  const navigation = use(NavigationContext);
  return useSyncExternalStore(
    (change) => {
      if (navigation === undefined) return () => {};
      const on = navigation.addListener("focus", change);
      const off = navigation.addListener("blur", change);
      return () => {
        on();
        off();
      };
    },
    () => navigation?.isFocused() ?? true,
  );
}
