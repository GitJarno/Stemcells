// Replaces `features/threads/thread-list-v2-row-appearance.ts`
// (`substitutes.cjs`; Android's `.android.ts` stays T3's): on the phone's
// own screen each row is a card, as the original app's were, its Cell beside it
// (`home/RowCell.tsx`). The iPad's sidebar keeps T3's rows.
import type { ViewStyle } from "react-native";

import * as Upstream from "../../../features/threads/thread-list-v2-row-appearance";
import type { MobileThemeVariables } from "../../../lib/mobileTheme";

export * from "../../../features/threads/thread-list-v2-row-appearance";

export const THREAD_LIST_V2_ROW_CONTENT_CLASS_NAME = "pl-3 pr-4 py-3";
export const THREAD_LIST_V2_ROW_DIVIDERS = false;

/** A card: inset from the screen's edges, apart from the next, its corners round; a swipe stays inside it. */
const CARD = {
  marginHorizontal: 12,
  marginBottom: 8,
  borderRadius: 20,
  overflow: "hidden",
} satisfies ViewStyle;

export function getThreadListV2RowAppearance(
  theme: MobileThemeVariables,
  sidebarPane: boolean,
  selected: boolean,
): ReturnType<typeof Upstream.getThreadListV2RowAppearance> {
  const kept = Upstream.getThreadListV2RowAppearance(theme, sidebarPane, selected);
  if (sidebarPane) return kept;
  const card = theme["--color-grouped-card"];
  return {
    ...kept,
    className: "bg-grouped-card",
    swipeContainerStyle: CARD,
    swipeBackgroundColor: card,
    providerIconSurfaceColor: card,
  };
}
