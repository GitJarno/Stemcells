import { useLayoutEffect, useRef } from "react";

import { viewerHearsFirst } from "../media/viewer";
import { isCommandPaletteOpen, isTerminalFocused, shortcutMatcher } from "../upstream/keys";

export interface WorkspaceKeyHandlers {
  /** Each returns false when it had nothing to act on, letting the key through. */
  readonly newCell: () => boolean;
  readonly closeTab: () => boolean;
  readonly splitRight: () => boolean;
  readonly splitDown: () => boolean;
  readonly closePane: () => boolean;
}

/**
 * Keys that win over upstream's: ⌘T, a new Cell in the tab (upstream's "new
 * right-panel tab"), ⌘D (upstream's "toggle diff") and ⌘⇧D. Inside a
 * terminal they stay the terminal's (new tab there, split).
 */
const WINNING_KEYS = [
  { matches: shortcutMatcher("mod+t"), run: "newCell" },
  { matches: shortcutMatcher("mod+shift+w"), run: "closeTab" },
  { matches: shortcutMatcher("mod+d"), run: "splitRight" },
  { matches: shortcutMatcher("mod+shift+d"), run: "splitDown" },
] as const;

/**
 * ⌘W closes the innermost thing first: upstream's terminal, then its open
 * right-panel tab, and only when neither took the key, the pane.
 */
const matchesClosePane = shortcutMatcher("mod+w");

/**
 * The workspace's key listeners: one heard on the way down, before the
 * chats', and ⌘W on the way back up. A picture viewer that is up hears
 * every key first, and the workspace stands down.
 */
export function workspaceKeyListeners(latest: () => WorkspaceKeyHandlers): {
  readonly onKeyDownCapture: (event: KeyboardEvent) => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
} {
  return {
    onKeyDownCapture: (event) => {
      if (viewerHearsFirst(event)) return;
      if (event.defaultPrevented || event.repeat || isCommandPaletteOpen()) return;
      if (isTerminalFocused()) return;
      const key = WINNING_KEYS.find((candidate) => candidate.matches(event));
      if (!key || !latest()[key.run]()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    onKeyDown: (event) => {
      if (viewerHearsFirst(event)) return;
      if (event.defaultPrevented || isCommandPaletteOpen() || isTerminalFocused()) return;
      if (!matchesClosePane(event)) return;
      // Holding ⌘W must not run on into the next pane, or the window.
      if (event.repeat || latest().closePane()) event.preventDefault();
    },
  };
}

/** Under Settings or Usage the workspace stands down: every key goes through. */
const STOOD_DOWN: WorkspaceKeyHandlers = {
  newCell: () => false,
  closeTab: () => false,
  splitRight: () => false,
  splitDown: () => false,
  closePane: () => false,
};

export function useWorkspaceKeys(handlers: WorkspaceKeyHandlers, heard: boolean) {
  const latest = useRef(handlers);
  // oxlint-disable-next-line t3code/react-effect-budget -- Point the key listener at this render's handlers.
  useLayoutEffect(() => {
    latest.current = heard ? handlers : STOOD_DOWN;
  });
  // A layout effect, so this capture listener is in place before any chat's
  // own (passive-effect) listeners and hears these keys first.
  // oxlint-disable-next-line t3code/react-effect-budget -- Attach the window's keydown listeners; remove on unmount.
  useLayoutEffect(() => {
    const { onKeyDownCapture, onKeyDown } = workspaceKeyListeners(() => latest.current);
    window.addEventListener("keydown", onKeyDownCapture, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDownCapture, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
