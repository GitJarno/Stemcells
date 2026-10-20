/** Upstream's shortcut grammar and the focus facts our keys defer to. */
import { matchesKeybindingShortcut, parseKeybindingShortcut } from "@t3tools/shared/keybindings";

export { isCommandPaletteOpen } from "../../commandPaletteBus";
export { isTerminalFocused } from "../../lib/terminalFocus";

/** A shortcut in upstream's grammar ("mod+shift+d"), matched on this platform. */
export function shortcutMatcher(shortcut: string): (event: KeyboardEvent) => boolean {
  const parsed = parseKeybindingShortcut(shortcut);
  if (!parsed) throw new Error(`Invalid shortcut: ${shortcut}`);
  return (event) => matchesKeybindingShortcut(event, parsed, navigator.platform);
}
