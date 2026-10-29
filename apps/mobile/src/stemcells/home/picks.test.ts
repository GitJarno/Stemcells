import { describe, expect, it } from "vite-plus/test";

import { inEffect, NO_PICKS, picksFrom, toggled } from "./picks";

describe("the home's picks", () => {
  it("ticks any number, and every one ticked is all, so a later one isn't left out", () => {
    const every = ["blog", "shop", "docs"];
    expect(toggled([], "blog", every)).toEqual(["blog"]);
    expect(toggled(["blog"], "shop", every)).toEqual(["blog", "shop"]);
    expect(toggled(["blog", "shop"], "blog", every)).toEqual(["shop"]);
    expect(toggled(["blog", "shop"], "docs", every)).toEqual([]);
  });

  it("narrows by nothing a pick names that's gone", () => {
    expect(inEffect(["blog", "gone"], ["blog", "shop"])).toEqual(["blog"]);
    expect(inEffect(["gone"], ["blog"])).toEqual([]);
  });

  it("reads back what it kept, and nothing from a file it can't read", () => {
    expect(picksFrom(JSON.stringify({ projects: ["blog"], machines: ["mac"] }))).toEqual({
      projects: ["blog"],
      machines: ["mac"],
    });
    expect(picksFrom(null)).toEqual(NO_PICKS);
    expect(picksFrom("{")).toEqual(NO_PICKS);
    expect(picksFrom(JSON.stringify({ projects: [1, "blog"] }))).toEqual({
      projects: ["blog"],
      machines: [],
    });
  });
});
