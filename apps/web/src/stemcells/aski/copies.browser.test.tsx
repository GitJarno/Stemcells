// Each copy of Aski goes where its Cell will stand: its box when its pane
// is on stage, else its tab's chip, and never into a page off stage, whose
// boxes are drawn but unseen. A copy wears the ink of where Aski stood.
import { describe, expect, it } from "vite-plus/test";

import type { CellRef, Tab } from "../tabs/layout";
import { useWorkspaceStore } from "../tabs/store";
import { render } from "../upstream/testRender";
import { askiStill, copyTargetOf } from "./copies";

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

describe("a copy of Aski", () => {
  it("wears the ink of where Aski stood, though that left the page as the copy was drawn", async () => {
    // A new chat's hero, where Aski stands, goes as the chat starts.
    const hero = document.createElement("div");
    hero.style.color = "rgb(240, 240, 240)";
    hero.style.background = "rgb(16, 16, 16)";
    document.body.append(hero);
    const drawing = askiStill(40, hero);
    hero.remove();
    const still = await drawing;

    const { data } = still.getContext("2d")!.getImageData(0, 0, still.width, still.height);
    let inked = 0;
    for (let at = 0; at < data.length; at += 4)
      if (data[at + 3] === 255 && data[at] === 240 && data[at + 1] === 240 && data[at + 2] === 240)
        inked += 1;
    expect(inked).toBeGreaterThan(0);
  });
});
