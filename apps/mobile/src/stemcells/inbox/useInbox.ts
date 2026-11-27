// Input's loop on the phone (stemcells/tasks/inbox.md, decisions 3, 5 to 7): each reading of the
// queue and the open chat goes through the Mac's loop (`line/kit.ts`). A step that names a Cell
// opens it in place of the open chat, beside the list or over it, so Back still returns to Input;
// the sky hears how far through a clearing the person is. One loop for the app's run.

import { useEffect, useSyncExternalStore } from "react";

import {
  allClear,
  type Cleared,
  entered,
  factAfter,
  left,
  LOOP_AT_REST,
  type Loop,
  opened,
  progressOf,
  publishProgress,
  read,
} from "../line/kit";
import { cellKey } from "../line/line";
import { useChatBeside, useHomeThreadSelection, useOpenChat } from "../upstream/home";

/** How the last clearing ended, for Input's empty page, and the fact it shows with it. */
export interface AllClear {
  readonly cleared: Cleared;
  /** An index into `STEM_CELL_FACTS`, chosen once per clearing. */
  readonly fact: number;
}

type Cell = { readonly environmentId: string; readonly id: string };

let loop: Loop = LOOP_AT_REST;
let wasOnInput = false;
let lastFact: number | null = null;
let shown: AllClear | null = null;
const listeners = new Set<() => void>();

/** Hands the loop one reading; the Cell to open now, if any. */
function step(
  queue: ReadonlyArray<string>,
  open: string | null,
  onInput: boolean,
  beside: boolean,
) {
  const reading = { queue, open, onInput, now: Date.now() };
  const next =
    onInput && !wasOnInput
      ? entered(loop, reading, beside)
      : read(wasOnInput && !onInput ? left(loop) : loop, reading);
  wasOnInput = onInput;
  loop = next.loop;
  // A Cell opened from Input's list, or one the loop opened landing: the loop follows it.
  if (onInput && open !== null && loop.following === null && next.open === null)
    loop = opened(loop, open);
  publishProgress(progressOf(loop));
  if (next.allClear) {
    allClear();
    lastFact = factAfter(lastFact, Math.random());
  }
  if (loop.cleared !== shown?.cleared) {
    shown = loop.cleared === null ? null : { cleared: loop.cleared, fact: lastFact ?? 0 };
    for (const listener of listeners) listener();
  }
  return next.open;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/**
 * Runs the loop over Input's Cells in view (`queue`, longest waiting first) while the home is
 * mounted; the last clearing's all-clear while Input's empty page should say it.
 */
export function useInbox(queue: ReadonlyArray<Cell>, onInput: boolean): AllClear | null {
  const open = useOpenChat();
  const beside = useChatBeside();
  const openChat = useHomeThreadSelection();
  const keys = queue.map(cellKey).join(" ");
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hand the loop each change of the queue, the open chat and the stage, and open the Cell its step names.
  useEffect(() => {
    const next = step(keys === "" ? [] : keys.split(" "), open, onInput, beside);
    const cell = next === null ? undefined : queue.find((each) => cellKey(each) === next);
    if (cell !== undefined) openChat(cell);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- The queue's keys say when it changed; the Cells and the opener are this render's.
  }, [keys, open, onInput, beside]);
  return useSyncExternalStore(subscribe, () => shown);
}
