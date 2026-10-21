/** Upstream's shortcut grammar and the focus facts our keys defer to. */
import { matchesKeybindingShortcut, parseKeybindingShortcut } from "@t3tools/shared/keybindings";

import { formatShortcutLabel } from "../../keybindings";

export { isCommandPaletteOpen } from "../../commandPaletteBus";
export { isTerminalFocused } from "../../lib/terminalFocus";

function parse(shortcut: string) {
  const parsed = parseKeybindingShortcut(shortcut);
  if (!parsed) throw new Error(`Invalid shortcut: ${shortcut}`);
  return parsed;
}

/** A shortcut in upstream's grammar ("mod+shift+d"), matched on this platform. */
export function shortcutMatcher(shortcut: string): (event: KeyboardEvent) => boolean {
  const parsed = parse(shortcut);
  return (event) => matchesKeybindingShortcut(event, parsed, navigator.platform);
}

/** A shortcut in upstream's grammar, written as this platform writes it ("⌥⌘G", "Ctrl+Alt+G"). */
export function shortcutLabel(shortcut: string): string {
  return formatShortcutLabel(parse(shortcut));
}
