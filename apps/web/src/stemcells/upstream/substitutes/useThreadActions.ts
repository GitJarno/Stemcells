// Replaces `hooks/useThreadActions.ts` (`plugin.ts`): a settle the person sends leaves its mark
// first (`tabs/handSettles.ts`), so the Cell's pane closes for it and never for upstream's
// auto-settle, which leaves the thread the same. The sidebar, its menu, the settle key, the
// Cell's line and Aski's column all settle through this hook (`upstream/settle.ts`).
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import * as ThreadUndo from "@t3tools/client-runtime/state/thread-undo";

import { useThreadActions as useUpstreamThreadActions } from "../../../hooks/useThreadActions";
import { markHandSettle, unmarkHandSettle } from "../../tabs/handSettles";

export * from "../../../hooks/useThreadActions";

// Sleep and Sleep until… act at once (stemcells/tasks/no-undo.md): their undo is let go as
// they land, as upstream lets go one a later act supersedes, so no notice or ⌘Z stands.
export function useThreadActions() {
  const actions = useUpstreamThreadActions();
  const settleThread = async (target: Parameters<typeof actions.settleThread>[0]) => {
    markHandSettle(target);
    const result = await actions.settleThread(target);
    if (result._tag !== "Success") unmarkHandSettle(target);
    else ThreadUndo.invalidate("settle", scopedThreadKey(target));
    return result;
  };
  const snoozeThread = async (...args: Parameters<typeof actions.snoozeThread>) => {
    const result = await actions.snoozeThread(...args);
    if (result._tag === "Success") ThreadUndo.invalidate("snooze", scopedThreadKey(args[0]));
    return result;
  };
  return { ...actions, settleThread, snoozeThread };
}
