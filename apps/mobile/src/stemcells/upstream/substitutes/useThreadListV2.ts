// Replaces `features/threads/useThreadListV2.ts` (`substitutes.cjs`): on the home's stages T3's
// list stands in each stage's own order (`../listOrder.ts`). Awake holds still: a Cell landing,
// asking or flying keeps its row where it stands (stemcells/tasks/awake-asleep.md), where T3's
// list moves a Cell by its runs. Asleep lists the latest asleep first. Elsewhere, T3's.
import { use, useMemo } from "react";

import * as Upstream from "../../../features/threads/useThreadListV2";
import { HomeStageContext } from "../../home/state";
import { inAsleepOrder, inAwakeOrder } from "../listOrder";

export * from "../../../features/threads/useThreadListV2";

export function useThreadListV2(input: Parameters<typeof Upstream.useThreadListV2>[0]) {
  const stage = use(HomeStageContext);
  const kept = Upstream.useThreadListV2(input);
  const minute = `${input.now.slice(0, 16)}:00.000Z`;
  const items = useMemo(
    () =>
      stage === "awake"
        ? inAwakeOrder(kept.items)
        : stage === "asleep"
          ? inAsleepOrder(kept.items, minute)
          : kept.items,
    [stage, kept.items, minute],
  );
  return items === kept.items ? kept : { ...kept, items };
}
