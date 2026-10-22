/**
 * Arrangements for the windows' tests: small ones built by hand, and random
 * ones from a seed, with a random legal move for each.
 */
import { ASKI_TAB_ID } from "../tabs/askiTab";
import { panesOf, type CellRef, type Column, type Pane, type Tab } from "../tabs/layout";
import type { Arrangement, Display, Moved, Placed, Rect } from "./arrangement";
import { gather, putBack } from "./gather";
import { carry, closeWindow, join, tear } from "./moves";

export const LAPTOP: Display = {
  key: "laptop",
  bounds: { x: 0, y: 0, width: 1512, height: 982 },
  workArea: { x: 0, y: 33, width: 1512, height: 949 },
};

export const MONITOR: Display = {
  key: "monitor",
  bounds: { x: 1512, y: -200, width: 2560, height: 1440 },
  workArea: { x: 1512, y: -175, width: 2560, height: 1415 },
};

export const chat = (threadId: string): CellRef => ({
  environmentId: "env",
  threadId,
  draftId: null,
});

/** A tab of chats side by side, one column each; panes are `<tab>.<chat>`. */
export function tab(id: string, ...threads: string[]): Tab {
  const panes: Pane[] = threads.map((thread) => ({ id: `${id}.${thread}`, cell: chat(thread) }));
  return {
    id,
    rows: [
      { id: `${id}.row`, columns: panes.map((pane) => ({ id: `${pane.id}.col`, panes: [pane] })) },
    ],
    focusedPaneId: panes[0]!.id,
  };
}

export const askiTab = (): Tab => ({ ...tab("aski-tab", "aski"), id: ASKI_TAB_ID });

export function frame(x: number, y = 100, width = 900, height = 700): Rect {
  return { x, y, width, height };
}

export function window(id: string, at: Rect, tabs: Tab[], display = LAPTOP.key): Placed {
  return {
    id,
    frame: at,
    display,
    fullScreen: false,
    workspace: { tabs, activeTabId: tabs[0]?.id ?? null },
  };
}

/** Windows front to back; the first leads. */
export function arrangement(...windows: Placed[]): Arrangement {
  return { windows, lead: windows[0]?.id ?? null, memories: [] };
}

/** The same arrangement whatever the windows' order: for comparing round trips. */
export function settled(arrangement: Arrangement) {
  return {
    windows: arrangement.windows.toSorted((a, b) => a.id.localeCompare(b.id)),
    memories: arrangement.memories,
  };
}

/** A small seeded generator (mulberry32), so a failing case can be replayed. */
export function random(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (below: number) => Math.floor(next() * below);
  const pick = <T>(items: ReadonlyArray<T>): T => items[int(items.length)]!;
  return { next, int, pick };
}

type Random = ReturnType<typeof random>;

function randomTab(rng: Random, id: string, chats: () => string): Tab {
  const rows = Array.from({ length: 1 + rng.int(2) }, (_, r) => ({
    id: `${id}.r${r}`,
    columns: Array.from({ length: 1 + rng.int(2) }, (_, c): Column => ({
      id: `${id}.r${r}c${c}`,
      panes: Array.from({ length: 1 + rng.int(2) }, (_, p) => ({
        id: `${id}.r${r}c${c}p${p}`,
        cell: chat(chats()),
      })),
    })),
  }));
  const tab: Tab = { id, rows, focusedPaneId: "" };
  return { ...tab, focusedPaneId: rng.pick(panesOf(tab)).id };
}

/** One to four windows of one to four tabs, on two displays; Aski's tab somewhere, sometimes. */
export function randomArrangement(seed: number): Arrangement {
  const rng = random(seed);
  let chats = 0;
  const nextChat = () => `chat-${(chats += 1)}`;
  const count = 1 + rng.int(4);
  const askiIn = rng.next() < 0.5 ? rng.int(count) : -1;
  const windows = Array.from({ length: count }, (_, w): Placed => {
    const display = rng.pick([LAPTOP, MONITOR]);
    const area = display.workArea;
    const tabs = Array.from({ length: 1 + rng.int(4) }, (_, t) =>
      randomTab(rng, `w${w}t${t}`, nextChat),
    );
    if (w === askiIn) tabs.unshift(askiTab());
    const width = 600 + rng.int(600);
    const height = 400 + rng.int(500);
    return {
      id: `w${w}`,
      frame: {
        x: area.x + rng.int(area.width - width),
        y: area.y + rng.int(area.height - height),
        width,
        height,
      },
      display: display.key,
      fullScreen: rng.next() < 0.1,
      workspace: { tabs, activeTabId: rng.pick(tabs).id },
    };
  });
  return { windows, lead: rng.pick(windows).id, memories: [] };
}

/** A random move that applies, or null when the dice found none. */
export function randomMove(arrangement: Arrangement, seed: number): Moved | null {
  const rng = random(seed);
  const tabs = arrangement.windows.flatMap((window) => window.workspace.tabs);
  const panes = tabs.flatMap(panesOf);
  const tabId = rng.pick(tabs).id;
  const where = { id: `new-${seed}`, frame: frame(40 + rng.int(400)), display: LAPTOP.key };
  const ids = { tab: `t-${seed}`, row: `r-${seed}`, column: `c-${seed}` };
  const other = rng.pick(arrangement.windows).id;
  switch (rng.int(8)) {
    case 0:
      return tear(arrangement, tabId, where);
    case 1:
      return join(arrangement, tabId, other, rng.int(5));
    case 2:
      return carry(arrangement, rng.pick(panes).id, {
        kind: "pane",
        anchor: rng.pick(panes).id,
        side: rng.pick(["left", "right", "above", "below"] as const),
        column: ids.column,
        rowWidth: 1200,
      });
    case 3:
      return carry(arrangement, rng.pick(panes).id, {
        kind: "strip",
        window: other,
        index: rng.int(5),
        ids,
      });
    case 4:
      return carry(arrangement, rng.pick(panes).id, { kind: "window", window: where, ids });
    case 5:
      return closeWindow(arrangement, other);
    case 6:
      return carry(arrangement, rng.pick(panes).id, {
        kind: "tab",
        tabId,
        column: ids.column,
        rowWidth: rng.pick([500, 1200]),
      });
    default: {
      const gathered = gather(arrangement, other, "laptop|monitor");
      if (gathered || arrangement.memories.length === 0) return gathered;
      return putBack(arrangement, rng.pick(arrangement.memories));
    }
  }
}
