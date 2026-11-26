// Aski's button on the Mac (stemcells/tasks/aski-side.md): at the slate's lower right, over the
// focused chat's composer (askiButton.css). A click or ⌘. turns the chat in front over to Aski and
// back; a hold or a right-click holds what's next. While Aski is in front it turns to what Aski
// shows (`stemcells_show`), and while Aski isn't, a dot says Aski answered.
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";

import { ASKI_FRESH_PATH, type AskiShow } from "../../../../../stemcells/aski/show.ts";
import { ASKI_BUTTON } from "../../../../../stemcells/words/aski.ts";
import { useNeeds } from "../needs/stream";
import { useColumnStore } from "../rail/column";
import { useOpenPlace } from "../settings/PlaceLink";
import { ASKI_TAB_ID } from "../tabs/askiTab";
import { CellMark } from "../tabs/CellMark";
import { activeTab, panesOf, type CellRef, type Tab, type Workspace } from "../tabs/layout";
import { cutTurn } from "../tabs/pageStrip";
import { readWorkspace } from "../tabs/store";
import { ASKI_SHORTCUT } from "../tabs/useWorkspaceKeys";
import { reducedMotion } from "../tokens/motion";
import {
  addCellChip,
  callsOf,
  chatHere,
  requestPrimary,
  useAskiAnsweredAt,
  useAskiThread,
} from "../upstream/askiSide";
import { shortcutLabel } from "../upstream/keys";
import { useCellTitle } from "../upstream/thread";
import {
  Menu,
  MenuItem,
  MenuPopup,
  toastManager,
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
  useSidebar,
} from "../upstream/ui";
import { AskiFigure } from "./AskiFigure";
import { askiTurnTarget, newShowCalls, nextOnInput, showToAct } from "./side";
import "./askiButton.css";

/** A hold this long opens the button's menu. */
const LONG_PRESS_MS = 450;

const focusedCellOf = (tab: Tab | null | undefined): CellRef | null => {
  if (!tab) return null;
  const panes = panesOf(tab);
  return (panes.find((pane) => pane.id === tab.focusedPaneId) ?? panes[0])?.cell ?? null;
};

/** Marks the page while a turn plays, for `askiButton.css`. */
const TURNING = "stemcellsAskiTurn";
let latestTurn = 0;

/**
 * Plays `turn` as Aski's turn (askiButton.css): Aski and the chat swap places through the button,
 * as down a pipe. A view transition, so the chats lay out once and the strip cuts beneath it.
 * Under Reduce Motion a crossfade; without view transitions the turn just happens.
 */
function playTurn(button: HTMLElement | null, turn: () => void): void {
  const run = () => cutTurn(() => flushSync(turn));
  const slate = button?.closest<HTMLElement>("[data-stemcells-slate]");
  if (!button || !slate || typeof document.startViewTransition !== "function") return run();
  const root = document.documentElement;
  root.dataset[TURNING] = reducedMotion() ? "fade" : "pipe";
  const mine = ++latestTurn;
  const transition = document.startViewTransition(run);
  // A turn started over this one skips it: its promises reject, which is no error.
  transition.ready.catch(() => undefined);
  void transition.finished
    .catch(() => undefined)
    .then(() => {
      if (mine === latestTurn) delete root.dataset[TURNING];
    });
}

export interface AskiSide {
  /** Whether the button stands: Aski is on (Settings › Aski) and its tab is in a window. */
  readonly on: boolean;
  /** Aski's chat, once it has one. */
  readonly aski: CellRef | null;
  /** Aski's tab is the one in front here, with no Settings over it. */
  readonly inFront: boolean;
  /** The tab a turn goes to; null from Aski with no Cell to go back to. */
  readonly target: Tab | null;
  /** One turn, to Aski or back; false when there's nowhere to turn. */
  readonly toggle: () => boolean;
  /** To Aski, without the chip: a fresh Aski starts clean. */
  readonly toAski: () => void;
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
}

/** The turn, for the button and the shortcut. */
export function useAskiSide(props: {
  on: boolean;
  aski: CellRef | null;
  workspace: Workspace;
  background: boolean;
  onTurn: (tabId: string) => void;
}): AskiSide {
  const { workspace } = props;
  const buttonRef = useRef<HTMLButtonElement>(null);
  // The Cell's tab last in front, however Aski was reached after: a turn back goes there.
  const [cameFrom, setCameFrom] = useState<string | null>(null);
  const active = workspace.activeTabId;
  if (active !== null && active !== ASKI_TAB_ID && active !== cameFrom) setCameFrom(active);
  const targetId = askiTurnTarget(workspace, cameFrom);
  const target = workspace.tabs.find((tab) => tab.id === targetId) ?? null;
  const turn = (to: string) => playTurn(buttonRef.current, () => props.onTurn(to));
  const toggle = () => {
    if (!props.on || targetId === null) return false;
    // "This" carries over: the Cell turned from is a chip in Aski's composer.
    const from = focusedCellOf(activeTab(workspace));
    if (targetId === ASKI_TAB_ID && props.aski && from?.draftId === null)
      addCellChip(props.aski, from);
    turn(targetId);
    return true;
  };
  return {
    on: props.on,
    aski: props.aski,
    inFront: active === ASKI_TAB_ID && !props.background,
    target: targetId === ASKI_TAB_ID ? null : target,
    toggle,
    toAski: () => {
      if (readWorkspace().activeTabId !== ASKI_TAB_ID) turn(ASKI_TAB_ID);
    },
    buttonRef,
  };
}

/**
 * The button: Aski's figure while a Cell is in front, the Cell it goes back to while Aski is.
 * `onNewCell` and `onOpenCell` are the workspace's New Cell and a Cell's link.
 */
export function AskiButton(props: {
  side: AskiSide;
  onNewCell: () => void;
  onOpenCell: (cell: CellRef) => void;
}) {
  const { side } = props;
  const { aski, buttonRef } = side;
  const [menuOpen, setMenuOpen] = useState(false);
  // A press on the button: whether its hold opened the menu, or the menu was open already.
  const press = useRef<{
    timer: ReturnType<typeof setTimeout>;
    long: boolean;
    wasOpen: boolean;
  } | null>(null);
  const backTo = side.inFront ? focusedCellOf(side.target) : null;
  const backTitle = useCellTitle(backTo);
  const label = side.inFront
    ? side.target === null
      ? ASKI_BUTTON.toAski
      : ASKI_BUTTON.back(side.target.name ?? backTitle ?? "New Cell")
    : ASKI_BUTTON.toAski;
  const dot = useAnswered(aski, side.inFront);
  const letGo = () => {
    if (press.current !== null) clearTimeout(press.current.timer);
  };
  return (
    <>
      {aski ? (
        <ShowWatch
          key={aski.threadId}
          aski={aski}
          inFront={side.inFront}
          onOpenCell={props.onOpenCell}
        />
      ) : null}
      <Menu
        modal={false}
        open={menuOpen}
        onOpenChange={(open, details) => {
          // The button's own presses are its own: its click turns or closes, its hold opens.
          const target = details.event?.target;
          const onButton = target instanceof Node && buttonRef.current?.contains(target);
          if (details.reason === "outside-press" && onButton) return;
          setMenuOpen(open);
        }}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                ref={buttonRef}
                type="button"
                data-stemcells-aski-button=""
                aria-label={dot ? `${label}, ${ASKI_BUTTON.answered}` : label}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  letGo();
                  const timer = setTimeout(() => {
                    if (press.current?.timer === timer) press.current.long = true;
                    setMenuOpen(true);
                  }, LONG_PRESS_MS);
                  press.current = { timer, long: false, wasOpen: menuOpen };
                }}
                onPointerUp={letGo}
                onPointerLeave={letGo}
                onPointerCancel={letGo}
                onClick={() => {
                  const held = press.current;
                  press.current = null;
                  if (held?.long) return;
                  if (menuOpen || held?.wasOpen) setMenuOpen(false);
                  // From Aski with no Cell to go back to, the menu is where to go.
                  else if (!side.toggle()) setMenuOpen(true);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenuOpen(true);
                }}
              />
            }
          >
            <span data-stemcells-aski-occupant="">
              {backTo ? <CellMark cell={backTo} /> : <AskiFigure aski={aski} />}
            </span>
            {dot ? <span data-stemcells-aski-dot="" aria-hidden /> : null}
          </TooltipTrigger>
          <TooltipPopup side="left">
            {side.inFront ? label : ASKI_BUTTON.toAskiHint} {shortcutLabel(ASKI_SHORTCUT)}
          </TooltipPopup>
        </Tooltip>
        <MenuPopup anchor={buttonRef} side="top" align="end">
          <ButtonMenu
            aski={aski}
            onFresh={() => void freshAski(side.toAski)}
            onNewCell={props.onNewCell}
            onOpenCell={props.onOpenCell}
          />
        </MenuPopup>
      </Menu>
    </>
  );
}

/** New Aski: the server starts one and settles the one before; Aski's tab follows it there. */
async function freshAski(toAski: () => void): Promise<void> {
  const response = await requestPrimary("POST", ASKI_FRESH_PATH).catch(() => null);
  if (!response?.ok) {
    toastManager.add({ type: "error", title: ASKI_BUTTON.freshFailed });
    return;
  }
  toAski();
}

/** What's next, under the button. Mounted only while open, so the needs move nothing else. */
function ButtonMenu(props: {
  aski: CellRef | null;
  onFresh: () => void;
  onNewCell: () => void;
  onOpenCell: (cell: CellRef) => void;
}) {
  const { needs } = useNeeds();
  const next = nextOnInput(needs, props.aski?.threadId ?? null);
  const { aski } = props;
  return (
    <>
      {aski ? (
        <MenuItem title={ASKI_BUTTON.menu.freshHint} onClick={props.onFresh}>
          {ASKI_BUTTON.menu.fresh}
        </MenuItem>
      ) : null}
      <MenuItem onClick={props.onNewCell}>{ASKI_BUTTON.menu.cell}</MenuItem>
      {next && aski ? (
        <MenuItem
          onClick={() =>
            props.onOpenCell({
              environmentId: aski.environmentId,
              threadId: next.threadId,
              draftId: null,
            })
          }
        >
          {ASKI_BUTTON.menu.input(next.count)}
        </MenuItem>
      ) : null}
    </>
  );
}

/**
 * Whether Aski has answered since the person last had it in front: its chat's last reply,
 * against the one there when they last looked (or when the window opened). Static until then.
 */
function useAnswered(aski: CellRef | null, inFront: boolean): boolean {
  const answeredAt = useAskiAnsweredAt(aski);
  const [seen, setSeen] = useState<string | null | undefined>(undefined);
  if (answeredAt !== undefined && answeredAt !== seen && (seen === undefined || inFront)) {
    setSeen(answeredAt);
  }
  return !inFront && seen !== undefined && answeredAt != null && answeredAt !== seen;
}

/** When the person last pressed or typed in this window, for `mayShow`. */
let touchedAt = 0;
const touched = () => {
  touchedAt = Date.now();
};

/**
 * Turns to what Aski shows, while Aski is in front and the person is at it (`mayShow`): each
 * completed `stemcells_show` call in Aski's own chat once, the newest of any that come together.
 * What its chat holds when it comes in front is let go, so neither a reload nor a turn replays.
 */
function ShowWatch(props: {
  aski: CellRef;
  inFront: boolean;
  onOpenCell: (cell: CellRef) => void;
}) {
  const thread = useAskiThread(props.inFront ? props.aski : null);
  const handled = useRef<ReadonlySet<string> | null>(null);
  const openPlace = useOpenPlace();
  const sidebar = useSidebar();
  const show = useEffectEvent((shown: AskiShow) => {
    if (shown.kind === "cell") {
      props.onOpenCell({
        environmentId: shown.environmentId,
        threadId: shown.threadId,
        draftId: null,
      });
    } else if (shown.kind === "settings") {
      openPlace(shown.place, props.aski.environmentId);
    } else {
      const column = useColumnStore.getState();
      column.setStage(shown.stage);
      if (column.width !== "cells") column.setWidth("cells");
      if (!sidebar.open) sidebar.setOpen(true);
    }
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hear the person's presses and keys, for the show's gate; remove on unmount.
  useEffect(() => {
    window.addEventListener("pointerdown", touched, { passive: true, capture: true });
    window.addEventListener("keydown", touched, { passive: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", touched, { capture: true });
      window.removeEventListener("keydown", touched, { capture: true });
    };
  }, []);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Act on show calls as Aski's chat gains them; Aski out of front starts the count again.
  useEffect(() => {
    if (!props.inFront) handled.current = null;
    if (thread === null) return;
    const { fresh, handled: next } = newShowCalls(
      callsOf(thread, props.aski.threadId),
      handled.current,
    );
    handled.current = next;
    const gate = {
      askiInFront: props.inFront,
      visible: document.visibilityState === "visible",
      lastTouchAt: touchedAt,
      now: Date.now(),
    };
    const here = (threadId: string) =>
      chatHere({ environmentId: props.aski.environmentId, threadId, draftId: null });
    for (const call of fresh.toReversed()) {
      const shown = showToAct(call, props.aski.environmentId, gate, here);
      if (shown === null) continue;
      show(shown);
      return;
    }
  }, [thread, props.inFront, props.aski.environmentId, props.aski.threadId]);
  return null;
}
