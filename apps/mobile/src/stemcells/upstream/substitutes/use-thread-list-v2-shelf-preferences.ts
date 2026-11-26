// Replaces `features/threads/use-thread-list-v2-shelf-preferences.ts` (`substitutes.cjs`): on
// the home's tabs the tab is the shelf: no header (the row's seam), every shelf open, the settled
// one only on Asleep. Each tab has its own order (`../listOrder.ts`), so T3's arranging by hand,
// offered only with the working shelf off, stays off. Elsewhere the person's choice stands.
import { use } from "react";

import * as Upstream from "../../../features/threads/use-thread-list-v2-shelf-preferences";
import { HomeStageContext } from "../../home/state";

export * from "../../../features/threads/use-thread-list-v2-shelf-preferences";

const noop = () => undefined;

export function useThreadListV2ShelfPreferences(): ReturnType<
  typeof Upstream.useThreadListV2ShelfPreferences
> {
  const kept = Upstream.useThreadListV2ShelfPreferences();
  const stage = use(HomeStageContext);
  if (stage === null) return kept;
  return {
    ...kept,
    workingShelfEnabled: true,
    workingShelfExpanded: true,
    // Open, it reads older settled Cells page by page: on Awake, "Loading" and a drifting count.
    settledShelfExpanded: stage === "asleep",
    snoozedShelfExpanded: true,
    toggleWorkingShelf: noop,
    toggleSettledShelf: noop,
    toggleSnoozedShelf: noop,
  };
}
