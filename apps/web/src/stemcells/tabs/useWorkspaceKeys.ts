import { useLayoutEffect, useRef } from "react";

import { isCommandPaletteOpen, isTerminalFocused, shortcutMatcher } from "../upstream/keys";

export interface WorkspaceKeyHandlers {
  /** Each returns false when it had nothing to act on, letting the key through. */
  readonly newTab: () => boolean;
  readonly closeTab: () => boolean;
  readonly splitRight: () => boolean;
  readonly splitDown: () => boolean;
  readonly closePane: () => boolean;
}

/**
 * Keys that win over upstream's: ⌘T (upstream's "new right-panel tab"), ⌘D
 * (upstream's "toggle diff") and ⌘⇧D. Inside a terminal they stay the
 * terminal's (new tab there, split).
 */
const WINNING_KEYS = [
  { matches: shortcutMatcher("mod+t"), run: "newTab" },
  { matches: shortcutMatcher("mod+shift+w"), run: "closeTab" },
  { matches: shortcutMatcher("mod+d"), run: "splitRight" },
  { matches: shortcutMatcher("mod+shift+d"), run: "splitDown" },
] as const;

/**
 * ⌘W closes the innermost thing first: upstream's terminal, then its open
 * right-panel tab, and only when neither took the key, the pane.
 */
const matchesClosePane = shortcutMatcher("mod+w");

export function useWorkspaceKeys(handlers: WorkspaceKeyHandlers) {
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });
  // A layout effect, so this capture listener is in place before any chat's
  // own (passive-effect) listeners and hears these keys first.
  useLayoutEffect(() => {
    const onKeyDownCapture = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isCommandPaletteOpen()) return;
      if (isTerminalFocused()) return;
      const key = WINNING_KEYS.find((candidate) => candidate.matches(event));
      if (!key || !latest.current[key.run]()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isCommandPaletteOpen() || isTerminalFocused()) return;
      if (!matchesClosePane(event)) return;
      // Holding ⌘W must not run on into the next pane, or the window.
      if (event.repeat || latest.current.closePane()) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDownCapture, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDownCapture, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
