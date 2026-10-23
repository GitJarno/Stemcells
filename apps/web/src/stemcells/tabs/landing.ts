/**
 * Where a new Cell lands (stemcells/tasks/aski-manager.md, decision 6): in
 * its project's tab, in whichever window holds it. A tab is the project of
 * its first pane. The Cell joins the project's tab used last that has room
 * for another column (300 px each, 4 panes at most). With none, it gets a
 * new tab after the project's tabs; a project with no tab, a new tab at the
 * end of the strip Aski's tab heads. Aski's tab never takes one, and
 * nothing comes to the front: the person stays where they are.
 */
import { isAskiTab } from "./askiTab";
import {
  CELL_COLUMN_WIDTH,
  EMPTY_WORKSPACE,
  insertTab,
  joinTab,
  openTab,
  paneShowing,
  panesOf,
  type CellRef,
  type Column,
  type NewIds,
  type Tab,
  type Workspace,
} from "./layout";

/** The most panes a tab takes when Cells land in it. */
export const CELLS_PER_TAB = 4;

export interface LandingWindow {
  readonly workspace: Workspace;
  /** Its tabs used last, most recent first, where the window knows them. */
  readonly visited: readonly string[];
  /** How wide a tab's row shows there. */
  readonly rowWidth: (tabId: string) => number;
  /** The unsent new Cell's tab (`newCell.ts`): it takes no Cell, and stays last. */
  readonly passing?: string | null;
}

/**
 * Each window's workspace once `cells` have landed, `windows` front to
 * back; a window nothing landed in keeps its own. A Cell already showing
 * stays where it is. `projectOf` names a Cell's project, null when unknown.
 */
export function landCells(
  windows: readonly LandingWindow[],
  cells: readonly CellRef[],
  projectOf: (cell: CellRef) => string | null,
  ids: () => NewIds,
): Workspace[] {
  const workspaces = windows.map((window) => window.workspace);
  const passing = new Set(windows.flatMap((window) => window.passing ?? []));
  const projectOfTab = (tab: Tab) => {
    const first = panesOf(tab)[0]?.cell;
    return isAskiTab(tab) || passing.has(tab.id) || !first ? null : projectOf(first);
  };

  for (const cell of cells) {
    if (workspaces.some((workspace) => paneShowing(workspace, cell))) continue;
    const project = projectOf(cell);
    const theirs = workspaces.flatMap((workspace, at) =>
      byUse(workspace, windows[at]!.visited)
        .filter((tab) => project !== null && projectOfTab(tab) === project)
        .map((tab) => ({ at, tab })),
    );
    const fresh = ids();
    const roomy = theirs.find(({ at, tab }) => hasRoom(tab, windows[at]!.rowWidth(tab.id)));
    if (roomy) {
      const { at, tab } = roomy;
      const pane = { id: fresh.pane, cell };
      workspaces[at] = joinTab(
        workspaces[at]!,
        tab.id,
        pane,
        fresh.column,
        windows[at]!.rowWidth(tab.id),
      );
      continue;
    }
    const tab = openTab(EMPTY_WORKSPACE, fresh, cell).tabs[0]!;
    const last = theirs[0];
    if (last) {
      const { tabs } = workspaces[last.at]!;
      let index = tabs.indexOf(last.tab) + 1;
      while (index < tabs.length && projectOfTab(tabs[index]!) === project) index += 1;
      workspaces[last.at] = insertTab(workspaces[last.at]!, tab, index);
      continue;
    }
    const home = Math.max(
      0,
      workspaces.findIndex((workspace) => workspace.tabs.some(isAskiTab)),
    );
    const strip = workspaces[home];
    if (strip === undefined) continue;
    const end = strip.tabs.length - (passing.has(strip.tabs.at(-1)?.id ?? "") ? 1 : 0);
    workspaces[home] = insertTab(strip, tab, end);
  }
  return workspaces;
}

/**
 * Room for one more column beside the last pane, as `joinTab` puts it: under
 * 4 panes, that pane alone in its column (a stack takes it below), and
 * every column of the row still 300 px wide.
 */
function hasRoom(tab: Tab, rowWidth: number): boolean {
  const panes = panesOf(tab);
  const last = panes.at(-1);
  const holdsLast = (column: Column) => column.panes.some((pane) => pane.id === last?.id);
  const row = tab.rows.find((candidate) => candidate.columns.some(holdsLast));
  return (
    panes.length < CELLS_PER_TAB &&
    row !== undefined &&
    row.columns.find(holdsLast)?.panes.length === 1 &&
    (row.columns.length + 1) * CELL_COLUMN_WIDTH <= rowWidth
  );
}

/** A window's tabs, used last first: those it remembers, its active one, then the strip's order. */
function byUse(workspace: Workspace, visited: readonly string[]): Tab[] {
  const rank = (tab: Tab) => {
    const seen = visited.indexOf(tab.id);
    if (seen >= 0) return seen;
    return tab.id === workspace.activeTabId ? visited.length : visited.length + 1;
  };
  return workspace.tabs
    .map((tab, index) => ({ tab, index, rank: rank(tab) }))
    .toSorted((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ tab }) => tab);
}
