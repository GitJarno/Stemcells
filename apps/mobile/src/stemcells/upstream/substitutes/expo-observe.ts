// Replaces the `expo-observe` package for upstream's importers (`substitutes.cjs`): T3's crash
// reporter, which records the app's errors and sends them on. Stemcells reports nothing, and
// the package's native side is left out of the build (`package.json`, autolinking), so this
// never imports it.
import type { ObserveModule } from "expo-observe";

export const Observe: Pick<ObserveModule, "configure" | "dispatchEvents" | "reportError"> = {
  configure: () => {},
  dispatchEvents: async () => {},
  reportError: () => {},
};
