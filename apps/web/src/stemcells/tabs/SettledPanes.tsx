import { useEffect, useRef } from "react";

import { useCellSettled } from "../upstream/thread";
import { useHandSettledAt } from "./handSettles";
import type { Left } from "./settled";
import {
  COME_BACK_MS,
  comeBack,
  forgetLeft,
  keepLeft,
  leaveSlate,
  leavesForSettle,
  useLeft,
} from "./settled";
import type { Pane } from "./layout";
import { newIds, updateWorkspace } from "./store";

/**
 * Closes the pane at once when the person settles its Cell on this device; a settle anywhere
 * closes it as the server's word arrives (`windows/settling.ts`). An auto-settle never pulls a
 * chat from under its reader, and a settled Cell opened on purpose stays open
 * (`leavesForSettle`). `enabled` is false where the pane may not close.
 */
export function useLeavesWhenSettled(pane: Pane, enabled: boolean): void {
  const settled = useCellSettled(pane.cell);
  const markedAt = useHandSettledAt(pane.cell);
  const threadId = pane.cell?.threadId ?? null;
  // The thread this pane has shown unsettled.
  const sawUnsettled = useRef<string | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Close the pane when the person's settle of its Cell arrives.
  useEffect(() => {
    if (settled === false) sawUnsettled.current = threadId;
    const leaves = leavesForSettle({
      sawUnsettled: threadId !== null && sawUnsettled.current === threadId,
      settled,
      markedAt,
      now: Date.now(),
    });
    if (!enabled || !leaves) return;
    const out: { left: Left | null } = { left: null };
    updateWorkspace((workspace) => {
      const next = leaveSlate(workspace, pane.id, Date.now());
      out.left = next.left;
      return next.workspace;
    });
    if (out.left !== null) keepLeft(out.left);
  }, [settled, markedAt, threadId, enabled, pane.id]);
}

/**
 * Watches each Cell that left the slate while its settle can be undone,
 * and brings it back where it stood once it is unsettled. A pane closed by
 * its × leaves before its settle lands, so the Cell comes back only once it
 * was seen settled.
 */
export function SettledComeBack(props: { rowWidth: () => number }) {
  return useLeft().map((left) => (
    <ComeBack key={left.cell.threadId} left={left} rowWidth={props.rowWidth} />
  ));
}

function ComeBack(props: { left: Left; rowWidth: () => number }) {
  const { left, rowWidth } = props;
  const settled = useCellSettled(left.cell);
  const sawSettled = useRef(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Bring the Cell back once it is unsettled after being seen settled.
  useEffect(() => {
    if (settled === true) sawSettled.current = true;
    if (settled !== false || !sawSettled.current) return;
    updateWorkspace((workspace) => comeBack(workspace, left, newIds(), rowWidth()));
    forgetLeft(left.cell.threadId);
  }, [settled, left, rowWidth]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Forget the Cell once its come-back window ends; clear the timer.
  useEffect(() => {
    const timer = setTimeout(
      () => forgetLeft(left.cell.threadId),
      Math.max(0, left.at + COME_BACK_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [left]);
  return null;
}
