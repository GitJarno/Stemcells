/**
 * What the terminal drawer's opening height needs of upstream: the height
 * upstream opens it at (and stores for a chat on opening, dragged or not),
 * and one terminal row, measured the way upstream's terminal measures its
 * cells, in the font the person's settings give the terminal
 * (terminal.contract.test.ts).
 */
import * as Schema from "effect/Schema";
import {
  resolveTerminalFontPreference,
  resolveTerminalFontSizePreference,
  TYPOGRAPHY_ADVANCED_STORAGE_KEY,
} from "../../appearanceFonts";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useClientSettings } from "../../hooks/useSettings";
import { measureGhosttyCell } from "../../terminal/ghostty/renderer";
import { terminalFontFamily, terminalFontSize } from "../../terminal/ghostty/surface";
import { DEFAULT_THREAD_TERMINAL_HEIGHT } from "../../types";

/** The height upstream opens a drawer at: stored as it is, it was never dragged. */
export const UPSTREAM_DRAWER_HEIGHT = DEFAULT_THREAD_TERMINAL_HEIGHT;

/** The terminal's padding round its grid of rows, on each side. */
export const TERMINAL_GRID_PADDING = 4;

/** One row of the terminal, in px. */
export function useTerminalRowHeight(): number {
  const [advanced] = useLocalStorage(TYPOGRAPHY_ADVANCED_STORAGE_KEY, false, Schema.Boolean);
  const family = useClientSettings((settings) =>
    resolveTerminalFontPreference({
      advanced,
      code: settings.fontFamilyCode,
      terminal: settings.fontFamilyTerminal,
    }),
  );
  const size = useClientSettings((settings) =>
    resolveTerminalFontSizePreference({
      advanced,
      code: settings.fontSizeCode,
      terminal: settings.fontSizeTerminal,
    }),
  );
  return terminalRowHeight(size, family);
}

function terminalRowHeight(size: number, family: string): number {
  const fontSize = terminalFontSize(size);
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return Math.round(fontSize * 1.35);
  const trimmed = family.trim();
  return measureGhosttyCell(
    context,
    fontSize,
    terminalFontFamily(trimmed.length > 0 ? trimmed : undefined),
  ).height;
}
