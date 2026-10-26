import { describe, expect, it } from "vite-plus/test";

import { elsewhere, elsewhereWords, shows, type FilterProject } from "./filter";

const project = (name: string, ...memberKeys: string[]): FilterProject => ({
  key: name.toLowerCase(),
  name,
  memberKeys,
});

const shop = project("Shop", "mac:shop", "mini:shop-copy");
const blog = project("Blog", "mac:blog");
const ask = (projectId: string) => ({ projectId });

describe("the column's project filter", () => {
  it("shows a Cell of any project in the group, and every Cell with none picked", () => {
    expect(shows(shop, "mac", "shop")).toBe(true);
    expect(shows(shop, "mini", "shop-copy")).toBe(true);
    expect(shows(shop, "mac", "blog")).toBe(false);
    // The same project id on another machine is another project.
    expect(shows(shop, "mini", "shop")).toBe(false);
    expect(shows(null, "mac", "blog")).toBe(true);
  });

  it("says where the asks it leaves out are, in the projects' order, then the ones it can't place", () => {
    const asks = [ask("blog"), ask("shop"), ask("gone"), ask("blog")];
    expect(elsewhere(shop, [shop, blog], "mac", asks)).toEqual([
      { name: "Blog", count: 2 },
      { name: null, count: 1 },
    ]);
    expect(elsewhere(null, [shop, blog], "mac", asks)).toEqual([]);
    expect(elsewhere(blog, [shop, blog], "mac", [ask("blog")])).toEqual([]);
  });

  it("words them as a line under the asks", () => {
    expect(elsewhereWords([])).toBeNull();
    expect(elsewhereWords([{ name: "Blog", count: 2 }])).toBe("Also 2 in Blog");
    expect(
      elsewhereWords([
        { name: "Blog", count: 2 },
        { name: "Docs", count: 1 },
        { name: null, count: 1 },
      ]),
    ).toBe("Also 2 in Blog, 1 in Docs and 1 elsewhere");
  });
});
