import { describe, expect, it } from "vite-plus/test";

import { castLookOf, looksOf } from "../cell/looks";
import { cellNameOf } from "../cell/name";
import { seatAski } from "./askiTab";
import { EMPTY_WORKSPACE, openTab, type CellRef, type NewIds, type Workspace } from "./layout";
import { crewOf, dealRoster } from "./roster";

let counter = 0;
function ids(): NewIds {
  counter += 1;
  return {
    tab: `tab-${counter}`,
    row: `row-${counter}`,
    column: `column-${counter}`,
    pane: `pane-${counter}`,
  };
}

const thread = (threadId: string): CellRef => ({ environmentId: "env", threadId, draftId: null });

function withCells(...threadIds: string[]): Workspace {
  return threadIds.reduce(
    (workspace, id) => openTab(workspace, ids(), thread(id)),
    EMPTY_WORKSPACE,
  );
}

const DAY = "2027-03-10";

describe("the crew in view", () => {
  it("is every chat the workspace shows, once each, Aski's tab aside", () => {
    const workspace = seatAski(withCells("a", "b", "a", "c"), thread("aski-thread"), ids());
    expect(crewOf(workspace)).toEqual(["a", "b", "c"]);
  });

  it("deals each Cell its name's look, and two Cells of one name apart where the look has a colourway", () => {
    const crew = ["Otter", "Puffin", "Wren", "Heron", "Marten", "Lark"];
    for (const [codename, look] of dealRoster(crew, DAY)) {
      const own = castLookOf(cellNameOf(codename))!;
      expect(look.worn).toHaveLength(1);
      expect(look.worn[0]!.split("~")[0]).toBe(own);
    }
  });

  it("keeps a Cell's look while others come and go, and deals one that left again", () => {
    const first = dealRoster(["Otter", "Puffin", "Wren"], DAY);
    const wren = first.get("Wren");
    const second = dealRoster(["Wren", "Heron", "Marten"], DAY);
    expect(second.get("Wren")).toEqual(wren);
    expect(dealRoster(["Heron", "Marten"], DAY).has("Wren")).toBe(false);
    const back = dealRoster(["Heron", "Marten", "Wren"], DAY);
    expect(back.get("Heron")).toEqual(second.get("Heron"));
    const stayed = new Map([...back].filter(([name]) => name !== "Wren"));
    expect(back.get("Wren")).toEqual(looksOf(["Heron", "Marten", "Wren"], DAY, stayed).get("Wren"));
  });
});
