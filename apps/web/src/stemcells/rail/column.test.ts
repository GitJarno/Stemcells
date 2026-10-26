import { describe, expect, it } from "vite-plus/test";

import { parseColumnStage, parseColumnWidth } from "./column";

describe("the left column", () => {
  it("is the Cells' column unless the person chose the rail or upstream's list", () => {
    expect(parseColumnWidth(null)).toBe("cells");
    expect(parseColumnWidth("rail")).toBe("rail");
    expect(parseColumnWidth("list")).toBe("list");
    expect(parseColumnWidth("something else")).toBe("cells");
  });

  it("takes a column widened to upstream's list before as the Cells' column", () => {
    expect(parseColumnWidth("wide")).toBe("cells");
  });

  it("opens on what needs you unless the person opened another stage", () => {
    expect(parseColumnStage(null)).toBe("needs");
    expect(parseColumnStage("landed")).toBe("landed");
    expect(parseColumnStage("snoozed")).toBe("needs");
  });
});
