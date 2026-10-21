/**
 * The window's part in the app's windows: ⌥⌘T moves the active tab to a
 * new window, and ⌥⌘Z takes the latest move back; closing the window is a
 * move too; a workspace a move gave this window routes to its focused chat;
 * another window's request shows one of this window's chats; the lead takes
 * Aski's tab home from a window that closed without a move; tabs a move sent
 * to a window that couldn't open come back. Renders nothing, and does nothing
 * in a browser.
 */
import { useEffect, useEffectEvent, useLayoutEffect } from "react";

import { viewerHearsFirst } from "../media/viewer";
import { parseWorkspace } from "../tabs/layout";
import { readWorkspace, updateWorkspace } from "../tabs/store";
import { isCommandPaletteOpen, isTerminalFocused, shortcutMatcher } from "../upstream/keys";
import { toastManager } from "../upstream/ui";
import { welcomeAskiHome } from "./askiHome";
import { windowsBridge } from "./bridge";
import { closeThisWindow } from "./closeAsMove";
import type { Refusal } from "./moves";
import { moveTabToNewWindow } from "./newWindow";
import { takeTabsBack } from "./returned";
import { undoMove } from "./undoMove";

const matchesMoveToNewWindow = shortcutMatcher("mod+alt+t");
// ⌘Z stays the composer's.
const matchesUndoMove = shortcutMatcher("mod+alt+z");

/** Why a move couldn't go back, as the note says it. */
const refusals: Record<Refusal, string> = {
  changed: "Its windows have changed since.",
  elsewhere: "A chat it would bring back is open elsewhere now.",
};

/** ⌥⌘Z: the latest move back, or a quiet note that it can't go back any more, and why. */
async function pressUndoMove(): Promise<void> {
  const undone = await undoMove();
  if (undone === "undone" || undone === "none") return;
  toastManager.add({ type: "info", title: "Can't undo that move", description: refusals[undone] });
}

const desktop = windowsBridge();
if (desktop) {
  // Heard before any view mounts, so a close the person asks for is never missed.
  desktop.onCloseRequest(() => void closeThisWindow());
}

export function WindowsKeeper(props: {
  /** A move changed this window's workspace. */
  onMoved: () => void;
  /** Another window asked this one to show the chat in this pane. */
  onFocusPane: (paneId: string) => void;
}) {
  const onMoved = useEffectEvent(props.onMoved);
  const onFocusPane = useEffectEvent(props.onFocusPane);
  // A layout effect, so the key is heard before any chat's own listeners.
  useLayoutEffect(() => {
    const bridge = windowsBridge();
    if (!bridge) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (viewerHearsFirst(event) || event.defaultPrevented || event.repeat) return;
      if (isCommandPaletteOpen() || isTerminalFocused()) return;
      if (matchesUndoMove(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void pressUndoMove();
        return;
      }
      if (!matchesMoveToNewWindow(event)) return;
      const tabId = readWorkspace().activeTabId;
      if (!tabId || readWorkspace().tabs.length < 2) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void moveTabToNewWindow(tabId);
    };
    window.addEventListener("keydown", onKeyDown, true);
    const stopAdopt = bridge.onAdopt(() => onMoved());
    const stopFocus = bridge.onFocusPane((paneId) => onFocusPane(paneId));
    const stopClosed = bridge.onClosed((closed) =>
      updateWorkspace((current) => welcomeAskiHome(current, parseWorkspace(closed))),
    );
    const stopReturned = bridge.onReturned((returned) =>
      updateWorkspace((current) => takeTabsBack(current, parseWorkspace(returned))),
    );
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      stopAdopt();
      stopFocus();
      stopClosed();
      stopReturned();
    };
  }, []);
  // Drawn, and drawn again once a window started hidden shows: a window a
  // tab was carried out to has its still taken away now.
  useEffect(() => {
    const bridge = windowsBridge();
    if (!bridge) return;
    let frame = 0;
    const drawn = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => bridge.drawn());
      });
    };
    drawn();
    const stopShown = bridge.onShown(drawn);
    return () => {
      cancelAnimationFrame(frame);
      stopShown();
    };
  }, []);
  return null;
}
