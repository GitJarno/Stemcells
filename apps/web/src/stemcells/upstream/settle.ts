/**
 * Settling a Cell the way upstream's sidebar does: its settle command, and
 * the "Settled" notice with Undo it shows (`useThreadActions`), so Undo
 * puts back what the Cell had, its pin and snooze included. Through our
 * substitute, as the sidebar's goes, so the Cell's pane closes for it.
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";

import { useThreadActions } from "./substitutes/useThreadActions";

export function useSettleCell(): (cell: {
  readonly environmentId: string;
  readonly threadId: string;
}) => Promise<boolean> {
  const { settleThread } = useThreadActions();
  return async (cell) => {
    const result = await settleThread(
      scopeThreadRef(cell.environmentId as EnvironmentId, cell.threadId as ThreadId),
    );
    return result._tag === "Success";
  };
}
