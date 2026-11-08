// Replaces `features/layout/workspace/brand-header-options.tsx` (`substitutes.cjs`): the home's
// header, whose title (read where its brand isn't drawn, as the back button's label) says Cells.
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";

import * as Upstream from "../../../features/layout/workspace/brand-header-options";

export function getCompactBrandHeaderOptions(
  ...args: Parameters<typeof Upstream.getCompactBrandHeaderOptions>
): NativeStackNavigationOptions {
  return { ...Upstream.getCompactBrandHeaderOptions(...args), title: "Cells" };
}

export function getConnectionAwareBrandHeaderOptions(
  ...args: Parameters<typeof Upstream.getConnectionAwareBrandHeaderOptions>
): NativeStackNavigationOptions {
  return { ...Upstream.getConnectionAwareBrandHeaderOptions(...args), title: "Cells" };
}
