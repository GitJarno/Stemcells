/**
 * The window's part in the app's windows: ⌥⌘T moves the active tab to a
 * new window; a workspace a move gave this window routes to its focused
 * chat; another window's request shows one of this window's chats; the lead
 * takes Aski's tab home from a window the person closed; tabs a move sent to
 * a window that couldn't open come back.
 * Renders nothing, and does nothing in a browser.
 */
import { useEffect, useEffectEvent, useLayoutEffect } from "react";

import { viewerHearsFirst } from "../media/viewer";
import { parseWorkspace } from "../tabs/layout";
import { readWorkspace, updateWorkspace } from "../tabs/store";
import { isCommandPaletteOpen, isTerminalFocused, shortcutMatcher } from "../upstream/keys";
import { welcomeAskiHome } from "./askiHome";
import { windowsBridge } from "./bridge";
import { moveTabToNewWindow } from "./newWindow";
import { takeTabsBack } from "./returned";

const matchesMoveToNewWindow = shortcutMatcher("mod+alt+t");

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
      if (isCommandPaletteOpen() || isTerminalFocused() || !matchesMoveToNewWindow(event)) return;
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
  // Drawn: a window a tab was carried out to has its still taken away now.
  useEffect(() => {
    const bridge = windowsBridge();
    if (!bridge) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => bridge.drawn());
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return null;
}
