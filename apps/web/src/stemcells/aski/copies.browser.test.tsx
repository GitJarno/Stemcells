// Each copy of Aski goes where its Cell will stand: its box when its pane
// is on stage, else its tab's chip, and never into a page off stage, whose
// boxes are drawn but unseen.
import { describe, expect, it } from "vite-plus/test";

import type { CellRef, Tab } from "../tabs/layout";
import { useWorkspaceStore } from "../tabs/store";
import { render } from "../upstream/testRender";
import { copyTargetOf } from "./copies";

const cell = (threadId: string): CellRef => ({ environmentId: "e", threadId, draftId: null });
const tab = (id: string, ...threads: string[]): Tab => ({
  id,
  rows: [
    {
      id: `${id}-row`,
      columns: threads.map((thread) => ({
        id: `${id}-${thread}`,
        panes: [{ id: `${id}-${thread}-pane`, cell: cell(thread) }],
      })),
    },
  ],
  focusedPaneId: `${id}-${threads[0]}-pane`,
});

const BOX = { display: "inline-block", width: 24, height: 24 } as const;

/** The tab on stage shows Floof, and Pip's box is on its way; Otter's tab is off stage. */
function Slate() {
  return (
    <div>
      <div role="tablist">
        <span role="tab" data-stemcells-tab="here" style={{ ...BOX, width: 80 }} />
        <span role="tab" data-stemcells-tab="away" style={{ ...BOX, width: 80 }} />
      </div>
      <div data-stemcells-page="here">
        <span data-stemcells-cell-box="floof" style={BOX} />
      </div>
      <div data-stemcells-page="away" inert>
        <span data-stemcells-cell-box="otter" style={BOX} />
      </div>
    </div>
  );
}

describe("where a copy of Aski goes", () => {
  it("is the Cell's box on stage, else its tab's chip, else nowhere yet", async () => {
    const before = useWorkspaceStore.getState().workspace;
    using _restore = {
      [Symbol.dispose]: () => useWorkspaceStore.setState({ workspace: before }),
    };
    useWorkspaceStore.setState({
      workspace: { tabs: [tab("here", "floof", "pip"), tab("away", "otter")], activeTabId: "here" },
    });
    await using screen = await render(<Slate />);
    const chip = screen.container.querySelector('[data-stemcells-tab="away"]')!;

    expect(copyTargetOf("floof")?.into).toBe("box");
    expect(copyTargetOf("otter")).toEqual({ box: chip.getBoundingClientRect(), into: "chip" });
    expect(copyTargetOf("pip")).toBeNull();
    expect(copyTargetOf("nowhere")).toBeNull();
  });
});
