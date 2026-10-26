// Replaces `hooks/useThreadActions.ts` (`plugin.ts`): a settle the person sends leaves its mark
// first (`tabs/handSettles.ts`), so the Cell's pane closes for it and never for upstream's
// auto-settle, which leaves the thread the same. The sidebar, its menu, the settle key, the
// Cell's line and Aski's column all settle through this hook (`upstream/settle.ts`).
import { useThreadActions as useUpstreamThreadActions } from "../../../hooks/useThreadActions";
import { markHandSettle, unmarkHandSettle } from "../../tabs/handSettles";

export * from "../../../hooks/useThreadActions";

export function useThreadActions() {
  const actions = useUpstreamThreadActions();
  const settleThread = async (target: Parameters<typeof actions.settleThread>[0]) => {
    markHandSettle(target);
    const result = await actions.settleThread(target);
    if (result._tag !== "Success") unmarkHandSettle(target);
    return result;
  };
  return { ...actions, settleThread };
}
