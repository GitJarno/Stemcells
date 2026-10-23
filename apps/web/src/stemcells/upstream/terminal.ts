/**
 * What the terminal drawer's opening height needs of upstream: the height
 * upstream opens it at (and stores for a chat on opening, dragged or not),
 * and one terminal row, measured the way upstream's terminal measures its
 * cells, in the font the person's settings give the terminal
 * (terminal.contract.test.ts). And how the drawer opens and closes.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { useContext, type Context } from "react";
import {
  resolveTerminalFontPreference,
  resolveTerminalFontSizePreference,
  TYPOGRAPHY_ADVANCED_STORAGE_KEY,
} from "../../appearanceFonts";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useClientSettings } from "../../hooks/useSettings";
import { PanelAnimationSuppressionProvider } from "../../panelAnimations";
import { measureGhosttyCell } from "../../terminal/ghostty/renderer";
import { terminalFontFamily, terminalFontSize } from "../../terminal/ghostty/surface";
import { useTerminalUiStateStore } from "../../terminalUiStateStore";
import { DEFAULT_THREAD_TERMINAL_HEIGHT } from "../../types";
import { timed } from "../tokens/motion";

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

/**
 * Upstream's "panels held still" context. It exports only the provider, and
 * in React 19 a context is its own provider (terminal.contract.test.ts).
 */
const PanelsHeld = PanelAnimationSuppressionProvider as unknown as Context<boolean>;

/** How upstream moves its panels: `usePanelAnimationSettings`. */
interface PanelMotion {
  readonly active: boolean;
  readonly durationMs: number;
}

/**
 * How a chat's terminal drawer opens and closes (the seam in upstream's
 * `ChatTerminalDrawers`, given upstream's panel motion). Where the person
 * set panel motion, as upstream moves its panels. Where it is off, its
 * default, on Stemcells' `keyboard` motion instead (`ours`, played by
 * `terminal/terminal.css`), so the drawer, the composer and the words over
 * it rise and fall as one; held still where upstream holds its panels still
 * (a route's first paint), and with less motion.
 */
export function useDrawerMotion(panels: PanelMotion): PanelMotion & { readonly ours: boolean } {
  const held = useContext(PanelsHeld);
  const less = useMediaQuery("(prefers-reduced-motion: reduce)");
  if (panels.durationMs > 0) return { ...panels, ours: false };
  return { active: !held && !less, durationMs: less ? 0 : keyboardMs(), ours: true };
}

let keyboard = 0;
/**
 * The `keyboard` token's full duration, read once the tokens' sheet is on
 * the page (with less motion the token is shorter, and the drawer doesn't
 * move).
 */
function keyboardMs(): number {
  if (keyboard === 0) keyboard = timed("keyboard").duration;
  return keyboard;
}

/** How long after a chat's terminal opens its drawer, drawn, still slides in. */
const OPENING_MS = 1000;

/**
 * When each chat's terminal last opened in this page, read from upstream's
 * store as it changes. The store reads what it kept as it is made, before
 * this subscribes, so a chat that comes back with its terminal open (a
 * load) is not among them.
 */
const openedAt = new Map<string, number>();
useTerminalUiStateStore.subscribe((next, previous) => {
  for (const [key, state] of Object.entries(next.terminalUiStateByThreadKey)) {
    if (state.terminalOpen && previous.terminalUiStateByThreadKey[key]?.terminalOpen !== true) {
      openedAt.set(key, performance.now());
    }
  }
});

/** Whether the chat's terminal opened just now, so its drawer slides in rather than being there. */
export function terminalJustOpened(threadRef: ScopedThreadRef): boolean {
  const at = openedAt.get(scopedThreadKey(threadRef));
  return at !== undefined && performance.now() - at < OPENING_MS;
}
