import { describe, expect, it } from "vite-plus/test";

import { boundaryOf } from "../../../../stemcells/boundary/check.ts";

describe("Stemcells' boundary with upstream", () => {
  it("only the upstream adapter imports upstream's code", () => {
    expect(boundaryOf(import.meta.dirname).violations()).toEqual([]);
  });
});
