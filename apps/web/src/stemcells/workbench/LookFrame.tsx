import { PanelRight, X } from "lucide-react";
import { useEffect, useEffectEvent, useRef } from "react";

import { CellMark } from "../tabs/CellMark";
import { moodOfStatus } from "../tabs/cellMood";
import { panesOf, type CellRef, type Tab } from "../tabs/layout";
import { useCellLastSent } from "../upstream/chat";
import { useCellTitle } from "../upstream/thread";
import { useCellStatus } from "../upstream/status";
import { Button, cn, Tooltip, TooltipPopup, TooltipTrigger } from "../upstream/ui";
import {
  closeCellPanel,
  escapeHeldElsewhere,
  openCellPanel,
  useCellPanelOpen,
  useCellSurfaceName,
  useInlinePanels,
} from "../upstream/workbench";
import { endLook, escapeMayEndLook, lookPaneId, railPanes, sentSince, type LastSent } from "./look";
import "../tokens/stemcells.css";
import "./look.css";

/**
 * Look on a tab's page (`look.ts`). Rendered before the page's grid and
 * workbench, it is there only while the tab is in Look, and its stylesheet
 * folds the page around it: the Look Cell steps out of its column and stack,
 * the other Cells hide, and the workbench takes the other half. It draws the
 * rail of the other Cells and the workbench's ×, and ends Look when the user
 * sends from the Cell or presses Esc.
 */
export function Look(props: {
  tab: Tab;
  /** Whether this tab's page is the one on screen, which hears the keys. */
  onStage: boolean;
  /** Focuses a pane and routes to its Cell. */
  onFocus: (paneId: string) => void;
}) {
  const { tab } = props;
  const focused = panesOf(tab).find((pane) => pane.id === tab.focusedPaneId) ?? null;
  const focusedPanelOpen = useCellPanelOpen(focused?.cell ?? null);
  const inline = useInlinePanels();
  const lookId = lookPaneId(tab, { focusedPanelOpen, inline });
  const lookCell = lookId === null ? null : (focused?.cell ?? null);

  const end = (goTo: string | null = null) => {
    if (lookId === null) return;
    const ending = endLook(tab, lookId, goTo);
    for (const cell of ending.close) closeCellPanel(cell);
    if (ending.focus !== null) props.onFocus(ending.focus);
  };
  useEndOnSend(lookCell, () => end());
  useEndOnEscape(lookId !== null && props.onStage, () => end());

  if (lookId === null) return null;
  return (
    <>
      <nav data-stemcells-look-rail="" aria-label="Other Cells">
        {railPanes(tab, lookId).map((pane) => (
          <RailMark key={pane.id} cell={pane.cell} onSelect={() => end(pane.id)} />
        ))}
      </nav>
      <div data-stemcells-look-close="">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Back to watching"
                onClick={() => end()}
              />
            }
          >
            <X />
          </TooltipTrigger>
          <TooltipPopup side="bottom">Back to watching (Esc)</TooltipPopup>
        </Tooltip>
      </div>
    </>
  );
}

/** Another Cell of the tab, on the rail: its mark, and a dot while it asks. Choosing it goes there. */
function RailMark(props: { cell: CellRef; onSelect: () => void }) {
  const title = useCellTitle(props.cell) ?? "New Cell";
  const asking = moodOfStatus(useCellStatus(props.cell)) === "needsYou";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-stemcells-look-mark=""
            aria-label={asking ? `${title}, asking` : title}
            onClick={props.onSelect}
            className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          />
        }
      >
        <CellMark cell={props.cell} />
        {asking ? <span data-stemcells-look-asking="" /> : null}
      </TooltipTrigger>
      <TooltipPopup side="right">{title}</TooltipPopup>
    </Tooltip>
  );
}

/**
 * After Look, a Cell keeps the name of its workbench's last surface, as a
 * chip in its header that opens Look again.
 */
export function LookChip(props: { cell: CellRef | null }) {
  const name = useCellSurfaceName(props.cell);
  const open = useCellPanelOpen(props.cell);
  const { cell } = props;
  if (cell === null || name === null || open) return null;
  return (
    <button
      type="button"
      data-stemcells-look-chip=""
      aria-label={`Look at ${name} again`}
      onClick={() => openCellPanel(cell)}
      className={cn(
        "ml-auto flex h-5 min-w-0 max-w-48 shrink cursor-pointer items-center gap-1 rounded-md border border-border px-1.5",
        "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <PanelRight aria-hidden className="size-3 shrink-0" />
      <span className="min-w-0 truncate">{name}</span>
    </button>
  );
}

/**
 * Sending ends Look: the user's reply starts the Cell's next stretch of
 * work, which they spend elsewhere. Read from the chat's own record of the
 * user's last message, so any way of sending counts.
 */
function useEndOnSend(cell: CellRef | null, end: () => void) {
  const lastSent = useCellLastSent(cell);
  const onSent = useEffectEvent(end);
  const key = cell === null ? null : `${cell.environmentId}/${cell.threadId}`;
  const watched = useRef<{ key: string | null; seen: LastSent }>({ key: null, seen: undefined });
  useEffect(() => {
    const current = watched.current;
    if (current.key !== key) {
      watched.current = { key, seen: lastSent };
      return;
    }
    if (key !== null && sentSince(current.seen, lastSent)) onSent();
    if (lastSent !== undefined) current.seen = lastSent;
  }, [key, lastSent]);
}

/**
 * Esc ends Look when nothing else used it. What was open is read as the key
 * goes down (window, capture), before anyone answers it; the decision is
 * made where the key comes back up (window, bubble), which a handler that
 * used the key stops it from reaching.
 */
function useEndOnEscape(active: boolean, end: () => void) {
  const onEscape = useEffectEvent(end);
  useEffect(() => {
    if (!active) return;
    let heldElsewhere = false;
    const onKeyDownCapture = (event: KeyboardEvent) => {
      if (event.key === "Escape") heldElsewhere = escapeHeldElsewhere();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (escapeMayEndLook(event, heldElsewhere)) onEscape();
    };
    window.addEventListener("keydown", onKeyDownCapture, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDownCapture, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active]);
}
