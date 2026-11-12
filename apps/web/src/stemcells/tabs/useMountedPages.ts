import { useEffect, useEffectEvent, useState } from "react";

import { keep, settle } from "./pager";
import { whenStill } from "./still";

/**
 * The tabs whose pages are mounted: the page on stage at once, the others kept (`pager.ts`) in
 * and out while the page is idle and the hands are still, as a page mounts in one go.
 */
export function useMountedPages(
  tabIds: readonly string[],
  stage: string | null,
  visited: readonly string[],
): readonly string[] {
  // Plain updates, not transitions: React starts a transition's render over for every urgent
  // one, so with a chat streaming a page's mount ran again and again for seconds.
  const [mounted, setMounted] = useState<readonly string[]>([]);
  const now = stage === null || mounted.includes(stage) ? mounted : [...mounted, stage];
  if (now !== mounted) setMounted(now);
  const next = settle(now, keep(now, tabIds, stage, visited));
  const due = next.length === now.length && next.every((id) => now.includes(id)) ? null : next;
  const settleNow = useEffectEvent(() => {
    if (due !== null) setMounted(due);
  });
  const dueKey = due === null ? null : due.join("\n");
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Settle the mounted pages when the page is idle; cancel if what is due changes first.
  useEffect(() => {
    if (dueKey === null) return;
    return whenStill(settleNow);
  }, [dueKey]);
  // In a stable order, so a page joining never moves the others in the document.
  return tabIds.filter((id) => now.includes(id)).toSorted();
}
