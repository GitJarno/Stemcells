/**
 * Look: when the focused Cell opens its workbench (a surface in its right
 * panel), that Cell and its workbench take the slate, and the tab's other
 * Cells fold into a rail of marks. Watch is the slate the rest of the time:
 * the tab's Cells in their grid, no workbench showing.
 *
 * Look is not stored. It is the focused Cell's panel, open, in a window wide
 * enough for the panel to sit beside its chat, on a tab of two Cells or
 * more (a tab of one is upstream's thread view, unchanged). Upstream keeps
 * each thread's panel, open or not and on which surface, and the tab keeps
 * its focused pane, so a tab remembers whether it was in Look and on which
 * Cell, across tab switches and reloads, with nothing of ours to keep.
 * Every way out of Look closes that panel through upstream's store, which
 * keeps its surfaces for the next time.
 */
import { panesOf, type CellRef, type Pane, type Tab } from "../tabs/layout";

export interface LookFacts {
  /** Whether the focused Cell's right panel is open. */
  readonly focusedPanelOpen: boolean;
  /** Whether the window is wide enough for upstream's panel to sit inline (not its sheet). */
  readonly inline: boolean;
}

/** The pane in Look on this tab; null while the tab watches. */
export function lookPaneId(tab: Tab | null, facts: LookFacts): string | null {
  if (tab === null || !facts.inline || !facts.focusedPanelOpen) return null;
  const panes = panesOf(tab);
  if (panes.filter((pane) => pane.cell !== null).length < 2) return null;
  const focused = panes.find((pane) => pane.id === tab.focusedPaneId);
  return focused?.cell ? focused.id : null;
}

export type CellPane = Pane & { readonly cell: CellRef };

/** The Cells the rail shows while one is in Look: the others, in reading order. */
export function railPanes(tab: Tab, lookId: string): CellPane[] {
  return panesOf(tab).filter((pane): pane is CellPane => pane.id !== lookId && pane.cell !== null);
}

/**
 * Ending Look: the panels to close and the pane to focus. Look's own Cell
 * closes its panel. Going to another Cell from the rail focuses it and
 * closes its panel too, if one was left open, so the slate watches.
 */
export function endLook(
  tab: Tab,
  lookId: string,
  goTo: string | null = null,
): { readonly close: CellRef[]; readonly focus: string | null } {
  const panes = panesOf(tab);
  const target = goTo === null ? null : (panes.find((pane) => pane.id === goTo) ?? null);
  const close = [panes.find((pane) => pane.id === lookId)?.cell, target?.cell].filter(
    (cell): cell is CellRef => cell != null,
  );
  return { close, focus: target?.id ?? null };
}

/**
 * When the user last wrote in a chat: an ISO time, null while it holds
 * none of theirs, undefined while that isn't known yet.
 */
export type LastSent = string | null | undefined;

/**
 * Whether the user sent a message from the Look Cell, given what was known
 * of its last message before (`seen`) and now. A chat whose messages
 * arrive after Look began (a reload) is not a send: only a change from a
 * known value is.
 */
export function sentSince(seen: LastSent, now: LastSent): boolean {
  return seen !== undefined && now !== undefined && now !== null && now !== seen;
}

/** The parts of a key press Esc's meaning depends on, as it reaches the window. */
export type EscapePress = Pick<
  KeyboardEvent,
  | "key"
  | "altKey"
  | "ctrlKey"
  | "metaKey"
  | "shiftKey"
  | "isComposing"
  | "keyCode"
  | "defaultPrevented"
  | "target"
>;

function tagOf(target: EventTarget | null): unknown {
  return (target as { tagName?: unknown } | null)?.tagName;
}

/** A field that may use Esc itself: an input, a text area, a select. The composer is none of these. */
function isFormField(target: EventTarget | null): boolean {
  const tag = tagOf(target);
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * A rich-text editor such as the composer. Its editor marks every Esc
 * handled to keep the browser's own behaviour off; when it really uses the
 * key (closing its `/` menu) it also stops it there, so the key never
 * reaches the window.
 */
function isTextEditor(target: EventTarget | null): boolean {
  return (target as { isContentEditable?: unknown } | null)?.isContentEditable === true;
}

/**
 * Whether Esc may end Look, for a press that reached the window, so nothing
 * on the way stopped it: a plain Esc (Shift+Esc leaves upstream's
 * browser), not part of composing text, not in a form field, not marked
 * handled (but for the composer's blanket mark), and while nothing of
 * upstream's held the key when it was pressed (an open menu, dialog or
 * palette, a focused terminal or browser).
 */
export function escapeMayEndLook(press: EscapePress, heldElsewhere: boolean): boolean {
  if (press.key !== "Escape") return false;
  if (press.altKey || press.ctrlKey || press.metaKey || press.shiftKey) return false;
  if (press.isComposing || press.keyCode === 229) return false;
  if (press.defaultPrevented && !isTextEditor(press.target)) return false;
  return !isFormField(press.target) && !heldElsewhere;
}
