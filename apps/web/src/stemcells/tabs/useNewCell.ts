import { useEffect, useEffectEvent, useRef } from "react";

import {
  draftHasWords,
  draftProject,
  readNewCellDraft,
  subscribeNewCellDraft,
} from "../upstream/newCell";
import { useNewCellDraftMaker } from "../upstream/newCellDraft";
import { newCellTaken } from "./newCell";
import { newIds, readWorkspace, useWorkspaceStore } from "./store";

/** How long (ms) the next new Cell waits after one was sent: the send goes first. */
const AFTER_SEND = 800;

/**
 * Keeps a new Cell ready past the last tab (`newCell.ts`), its draft made
 * ahead in the project a new tab would get. A draft kept from before (a
 * reload, or words left in it) comes back first. A blank one follows the
 * project of the last tab, while that tab is on stage and the pages rest.
 * `motion(moving)`: the pages started moving, or came to rest.
 */
export function useNewCell(lastTabOnStage: boolean): { motion: (moving: boolean) => void } {
  const newCell = useWorkspaceStore((store) => store.newCell);
  const { project, make } = useNewCellDraftMaker();
  const making = useRef(false);
  const moving = useRef(false);

  /** Makes a draft; `check` takes it up when the draft store has it. */
  const makeOne = useEffectEvent(async () => {
    if (making.current) return;
    making.current = true;
    try {
      await make().catch(() => null);
    } finally {
      making.current = false;
    }
  });

  /** The new Cell as the draft store has its draft now: kept, found, replaced or still to make. */
  const check = useEffectEvent(() => {
    const store = useWorkspaceStore.getState();
    const current = store.newCell;
    const found = readNewCellDraft();
    if (current !== null && found?.draftId === current.cell.draftId) return;
    if (current !== null && newCellTaken(readWorkspace(), current)) {
      // Sent from its own tab: the tab is a Cell's own now.
      store.settleNewCell();
      return;
    }
    if (found !== null) useWorkspaceStore.setState({ newCell: { ids: newIds(), cell: found } });
    else {
      if (current !== null) useWorkspaceStore.setState({ newCell: null });
      void makeOne();
    }
  });

  useEffect(() => subscribeNewCellDraft(() => check()), []);
  // Once there is a project to make one in, and again after one is sent.
  useEffect(() => {
    if (newCell !== null || project === null) return;
    const timer = setTimeout(check, readNewCellDraft() === null ? AFTER_SEND : 0);
    return () => clearTimeout(timer);
  }, [newCell, project]);

  /** A blank new Cell, off screen, follows `project` while the last tab is on stage. */
  const follow = useEffectEvent((project: string | null, onStage: boolean) => {
    const current = useWorkspaceStore.getState().newCell;
    if (current === null || !onStage || moving.current || project === null) return;
    if (newCellTaken(readWorkspace(), current)) return;
    if (draftProject(current.cell) === project || draftHasWords(current.cell)) return;
    void makeOne();
  });
  useEffect(() => follow(project, lastTabOnStage), [project, lastTabOnStage]);

  return {
    motion: (now) => {
      moving.current = now;
      if (!now) follow(project, lastTabOnStage);
    },
  };
}
