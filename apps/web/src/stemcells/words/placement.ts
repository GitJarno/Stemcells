/**
 * Where the Cells a message starts land (decision 15): the first takes the
 * draft's pane, and the others open as columns right after it, in the same
 * tab, while every column stays at least 300 px wide and the tab holds at
 * most 4 panes (the panes already there count). The rest open in new tabs
 * right after, by the same rule. With no room for a second column, each
 * gets its own tab. Focus stays with the first Cell.
 */

import {
  type CellRef,
  type Column,
  findPane,
  type NewIds,
  panesOf,
  type Tab,
  type Workspace,
} from "../tabs/layout";

/** The narrowest a column gets when Cells open beside each other. */
export const CELL_COLUMN_WIDTH = 300;
/** The most panes a tab takes when Cells open into it. */
export const CELLS_PER_TAB = 4;

/** Opens `cells` after the pane `paneId`, in a slate `gridWidth` wide. */
export function placeCells(
  workspace: Workspace,
  paneId: string,
  cells: ReadonlyArray<CellRef>,
  gridWidth: number,
  ids: () => NewIds,
): Workspace {
  const found = findPane(workspace, (pane) => pane.id === paneId);
  if (!found || cells.length === 0) return workspace;
  const fits = (columns: number) => columns * CELL_COLUMN_WIDTH <= gridWidth;
  const rest = [...cells];

  const beside = fill(found.tab, paneId, rest, fits);
  const tabs = workspace.tabs.map((tab) => (tab.id === beside.id ? beside : tab));
  let at = tabs.findIndex((tab) => tab.id === beside.id);
  while (rest.length > 0) {
    const fresh = ids();
    const tab: Tab = {
      id: fresh.tab,
      rows: [
        {
          id: fresh.row,
          columns: [{ id: fresh.column, panes: [{ id: fresh.pane, cell: rest.shift()! }] }],
        },
      ],
      focusedPaneId: fresh.pane,
    };
    at += 1;
    tabs.splice(at, 0, fill(tab, fresh.pane, rest, fits));
  }
  return { ...workspace, tabs };

  /** Columns after `afterPaneId`'s, in its row, while the tab has room. */
  function fill(
    tab: Tab,
    afterPaneId: string,
    queue: CellRef[],
    room: (columns: number) => boolean,
  ): Tab {
    let count = panesOf(tab).length;
    const rows = tab.rows.map((row) => {
      const index = row.columns.findIndex((column) =>
        column.panes.some((pane) => pane.id === afterPaneId),
      );
      if (index < 0) return row;
      const columns = [...row.columns];
      let insertAt = index + 1;
      while (queue.length > 0 && count < CELLS_PER_TAB && room(columns.length + 1)) {
        const fresh = ids();
        const column: Column = {
          id: fresh.column,
          panes: [{ id: fresh.pane, cell: queue.shift()! }],
        };
        columns.splice(insertAt, 0, column);
        insertAt += 1;
        count += 1;
      }
      return { ...row, columns };
    });
    return { ...tab, rows };
  }
}
