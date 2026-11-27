/**
 * The Mac's loop through Input (stemcells/tasks/inbox.md): each reading of the queue and the
 * focused pane's chat goes through `loop.ts`; what it opens goes in the focused pane
 * (`tabs/commands.ts`, `openCellHere`), and the composer there takes the caret once it lands.
 * The loop outlives the column, so turning it away and back keeps the clearing.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";

import { factAfter } from "../../../../../stemcells/words/inbox.ts";
import type { ColumnStage } from "../rail/column";
import { afterPaint } from "../tabs/afterPaint";
import { openCellHere } from "../tabs/commands";
import { focusedPane, type Workspace } from "../tabs/layout";
import { readWorkspace, useWorkspaceStore } from "../tabs/store";
import { entered, left, LOOP_AT_REST, type Loop, opened, progressOf, read } from "./loop";
import { allClear, publishProgress } from "./sky";

const FACT_STORAGE_KEY = "stemcells.inbox.fact";

interface Inbox {
  readonly loop: Loop;
  /** The fact the last all-clear shows, an index into `STEM_CELL_FACTS`. */
  readonly fact: number;
}

function readFact(): number | null {
  try {
    const stored = Number.parseInt(localStorage.getItem(FACT_STORAGE_KEY) ?? "", 10);
    return Number.isNaN(stored) ? null : stored;
  } catch {
    return null;
  }
}

let inbox: Inbox = { loop: LOOP_AT_REST, fact: 0 };
const listeners = new Set<() => void>();

function set(next: Inbox) {
  if (next.loop === inbox.loop && next.fact === inbox.fact) return;
  inbox = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

const readInbox = () => inbox;

const useInboxState = (): Inbox => useSyncExternalStore(subscribe, readInbox, readInbox);

/** The person opened `threadId` from Input's list: the loop follows it. */
export function inboxOpened(threadId: string): void {
  set({ ...inbox, loop: opened(inbox.loop, threadId) });
}

/** The next fact, once per all-clear, kept so the next clearing shows another. */
function nextFact(): number {
  const fact = factAfter(readFact(), Math.random());
  try {
    localStorage.setItem(FACT_STORAGE_KEY, String(fact));
  } catch {
    // Storage refused: the next all-clear may show this one again.
  }
  return fact;
}

const focusedChat = (workspace: Workspace): string | null => {
  const cell = focusedPane(workspace)?.cell ?? null;
  return cell === null || cell.draftId !== null ? null : cell.threadId;
};

/** The caret into the focused pane's composer, once its chat has drawn. */
function focusComposer(): void {
  afterPaint(() => {
    const pane = focusedPane(readWorkspace());
    if (pane === null) return;
    document
      .querySelector<HTMLElement>(
        `[data-stemcells-pane="${CSS.escape(pane.id)}"] [contenteditable='true']`,
      )
      ?.focus();
  });
}

/**
 * Runs the loop for the column: `queue` is Input's Cells by thread, longest waiting first, on
 * `environmentId`. Turning to Input opens its top; turning away stops the loop.
 */
export function useInbox(input: {
  readonly queue: ReadonlyArray<string>;
  readonly stage: ColumnStage;
  readonly environmentId: string | null;
}): Inbox {
  const { stage, environmentId } = input;
  const open = useWorkspaceStore((store) => focusedChat(store.workspace));
  const queueKey = input.queue.join(" ");
  const lastStage = useRef(stage);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Step the loop with each reading, opening its next chat in the workspace and telling the sky.
  useEffect(() => {
    const queue = queueKey === "" ? [] : queueKey.split(" ");
    const was = lastStage.current;
    lastStage.current = stage;
    const reading = { queue, open, onInput: stage === "needs", now: Date.now() };
    const before = inbox.loop;
    const step =
      stage === "needs" && was !== "needs"
        ? entered(before, reading, true)
        : read(stage !== "needs" && was === "needs" ? left(before) : before, reading);
    set({ loop: step.loop, fact: step.allClear ? nextFact() : inbox.fact });
    publishProgress(progressOf(step.loop));
    if (step.allClear) allClear();
    if (step.open !== null && environmentId !== null)
      openCellHere({ environmentId, threadId: step.open, draftId: null });
    // The chat it opened has landed: the next answer starts without a click.
    if (before.landing && !step.loop.landing && step.loop.following === open) focusComposer();
  }, [queueKey, open, stage, environmentId]);

  return useInboxState();
}
