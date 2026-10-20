import { X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cellNameOf } from "../cell/name";
import { useCellTitle } from "../upstream/thread";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../upstream/ui";
import { LookChip } from "../workbench/LookFrame";
import { CellMark } from "./CellMark";
import type { CellRef } from "./layout";

/** Upstream's panel toggles for the chat in a pane (thread details, terminal, right panel). */
const TOGGLES = "[data-workspace-titlebar-controls]";

/**
 * A pane's buttons, floating at its top-right while the pointer or focus is
 * in it (`workspace.css`): the Look chip first, then upstream's own panel
 * toggles for the chat, then × to close the pane. The toggles stay
 * upstream's, with upstream's state; the chip and × join their row, so the
 * three read as one. Until the chat has drawn its toggles (or where it
 * draws none), the chip and × float on their own.
 */
export function PaneButtons(props: { cell: CellRef | null; onClose: (() => void) | null }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [row, setRow] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const pane = anchor.current?.closest<HTMLElement>("[data-stemcells-pane]");
    if (!pane) return;
    // The toggles move as the chat lays out (beside its header, or at its
    // root once its right panel is there), and go with the chat: follow them.
    let current: HTMLElement | null = null;
    const follow = () => {
      if (current?.isConnected && pane.contains(current)) return;
      current = pane.querySelector<HTMLElement>(TOGGLES);
      setRow(current);
    };
    follow();
    const moved = new MutationObserver(follow);
    moved.observe(pane, { childList: true, subtree: true });
    return () => moved.disconnect();
  }, []);

  const buttons = (
    <>
      <LookChip cell={props.cell} />
      {props.onClose ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                data-stemcells-pane-close=""
                aria-label="Close pane"
                onClick={props.onClose}
              />
            }
          >
            <X aria-hidden />
          </TooltipTrigger>
          <TooltipPopup side="bottom">Close pane</TooltipPopup>
        </Tooltip>
      ) : null}
    </>
  );
  return (
    <>
      <span ref={anchor} hidden />
      {row ? createPortal(buttons, row) : <div data-stemcells-pane-buttons="">{buttons}</div>}
    </>
  );
}

/**
 * A pane with no composer names its Cell in a pill at its top-left, where
 * the line over the composer would otherwise say it (`workspace.css` shows
 * it only then).
 */
export function CellPill(props: { cell: CellRef }) {
  const title = useCellTitle(props.cell);
  return (
    <div data-stemcells-cell-pill="">
      <CellMark cell={props.cell} />
      <span data-stemcells-cell-pill-name="">{cellNameOf(props.cell.threadId)}</span>
      {title ? <span data-stemcells-cell-pill-title="">{title}</span> : null}
    </div>
  );
}
