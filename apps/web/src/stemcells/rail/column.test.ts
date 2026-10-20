import { describe, expect, it } from "vite-plus/test";

import { parseColumnWidth } from "./column";

describe("the left column's width", () => {
  it("is the rail unless the person widened it", () => {
    expect(parseColumnWidth(null)).toBe("rail");
    expect(parseColumnWidth("wide")).toBe("wide");
    expect(parseColumnWidth("rail")).toBe("rail");
    expect(parseColumnWidth("something else")).toBe("rail");
  });
});
