import { describe, expect, it } from "vite-plus/test";

import { shows, type FilterProject } from "./filter";

const project = (name: string, ...memberKeys: string[]): FilterProject => ({
  key: name.toLowerCase(),
  name,
  memberKeys,
});

const shop = project("Shop", "mac:shop", "mini:shop-copy");

describe("the column's project filter", () => {
  it("shows a Cell of any project in the group, and every Cell with none picked", () => {
    expect(shows(shop, "mac", "shop")).toBe(true);
    expect(shows(shop, "mini", "shop-copy")).toBe(true);
    expect(shows(shop, "mac", "blog")).toBe(false);
    // The same project id on another machine is another project.
    expect(shows(shop, "mini", "shop")).toBe(false);
    expect(shows(null, "mac", "blog")).toBe(true);
  });
});
