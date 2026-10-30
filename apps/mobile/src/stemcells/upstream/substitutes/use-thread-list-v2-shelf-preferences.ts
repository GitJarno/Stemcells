// Replaces `features/threads/use-thread-list-v2-shelf-preferences.ts` (`substitutes.cjs`): on
// the home's tabs the tab is the shelf, so T3's list draws no shelf header there
// (`features/threads/thread-list-v2-items.tsx`, at its seam) and its shelves stand open, but
// Settled's only on its own tab. Elsewhere the person's choice stands.
import { use } from "react";

import * as Upstream from "../../../features/threads/use-thread-list-v2-shelf-preferences";
import { HomeTabsContext } from "../../home/state";

export * from "../../../features/threads/use-thread-list-v2-shelf-preferences";

const noop = () => undefined;

export function useThreadListV2ShelfPreferences(): ReturnType<
  typeof Upstream.useThreadListV2ShelfPreferences
> {
  const kept = Upstream.useThreadListV2ShelfPreferences();
  const home = use(HomeTabsContext);
  if (home === null) return kept;
  return {
    ...kept,
    workingShelfExpanded: true,
    // Open, it reads older settled Cells page by page: on Flying, "Loading" and a drifting count.
    settledShelfExpanded: home.night,
    snoozedShelfExpanded: true,
    toggleWorkingShelf: noop,
    toggleSettledShelf: noop,
    toggleSnoozedShelf: noop,
  };
}
