// Replaces `features/threads/use-thread-list-v2-shelf-preferences.ts` (`substitutes.cjs`): on
// the home's tabs the tab is the shelf, so every shelf of T3's list stays open there and draws
// no header (`features/threads/thread-list-v2-items.tsx`, at its seam). Elsewhere the person's
// choice stands.
import { use } from "react";

import * as Upstream from "../../../features/threads/use-thread-list-v2-shelf-preferences";
import { HomeTabsContext } from "../../home/state";

export * from "../../../features/threads/use-thread-list-v2-shelf-preferences";

const noop = () => undefined;

export function useThreadListV2ShelfPreferences(): ReturnType<
  typeof Upstream.useThreadListV2ShelfPreferences
> {
  const kept = Upstream.useThreadListV2ShelfPreferences();
  if (use(HomeTabsContext) === null) return kept;
  return {
    ...kept,
    workingShelfExpanded: true,
    settledShelfExpanded: true,
    snoozedShelfExpanded: true,
    toggleWorkingShelf: noop,
    toggleSettledShelf: noop,
    toggleSnoozedShelf: noop,
  };
}
