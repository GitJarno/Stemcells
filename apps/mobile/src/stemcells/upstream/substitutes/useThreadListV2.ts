// Replaces `features/threads/useThreadListV2.ts` (`substitutes.cjs`): on the home's stages T3's
// list stands in each stage's own order (`../listOrder.ts`): Input the longest waiting first
// (stemcells/tasks/inbox.md), Awake by the time each row shows (stemcells/tasks/awake-asleep.md),
// Asleep the latest asleep first. Elsewhere, T3's.
import { use, useMemo } from "react";

import * as Upstream from "../../../features/threads/useThreadListV2";
import { CellStates, HomeStageContext } from "../../home/state";
import { inAsleepOrder, inAwakeOrder, inInputOrder } from "../listOrder";

export * from "../../../features/threads/useThreadListV2";

export function useThreadListV2(input: Parameters<typeof Upstream.useThreadListV2>[0]) {
  const stage = use(HomeStageContext);
  const states = use(CellStates);
  const kept = Upstream.useThreadListV2(input);
  const minute = `${input.now.slice(0, 16)}:00.000Z`;
  const items = useMemo(
    () =>
      stage === "needs"
        ? inInputOrder(kept.items, states)
        : stage === "awake"
          ? inAwakeOrder(kept.items, states)
          : stage === "asleep"
            ? inAsleepOrder(kept.items, minute)
            : kept.items,
    [stage, kept.items, minute, states],
  );
  return items === kept.items ? kept : { ...kept, items };
}
