// Replaces `features/threads/use-thread-list-v2-shelf-preferences.ts`
// (`substitutes.cjs`): on the home's tabs the tab is the shelf, so the
// shelves it holds start open (Asleep's snoozed and settled ones,
// Working's), and closing one holds while the home stands. Outside the tabs,
// and on every other shelf, the person's own choice stands.
import { use, useState } from "react";

import * as Upstream from "../../../features/threads/use-thread-list-v2-shelf-preferences";
import { HomeTabsContext } from "../../home/state";

export * from "../../../features/threads/use-thread-list-v2-shelf-preferences";

export function useThreadListV2ShelfPreferences(): ReturnType<
  typeof Upstream.useThreadListV2ShelfPreferences
> {
  const kept = Upstream.useThreadListV2ShelfPreferences();
  const tab = use(HomeTabsContext)?.tab;
  const [shut, setShut] = useState({ settled: false, snoozed: false, working: false });
  const toggle = (shelf: keyof typeof shut) => () =>
    setShut((now) => ({ ...now, [shelf]: !now[shelf] }));
  if (tab === "asleep")
    return {
      ...kept,
      settledShelfExpanded: !shut.settled,
      snoozedShelfExpanded: !shut.snoozed,
      toggleSettledShelf: toggle("settled"),
      toggleSnoozedShelf: toggle("snoozed"),
    };
  if (tab === "working")
    return { ...kept, workingShelfExpanded: !shut.working, toggleWorkingShelf: toggle("working") };
  return kept;
}
