/**
 * What a project's mark relies on in upstream: the colours a project's icon may wear. A colour
 * upstream adds needs a fill in `stemcells/brand/projectMark.ts`, or its projects draw gray.
 */
import { ProjectIconColor } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { MADE_FILL } from "../../../../../stemcells/brand/projectMark.ts";

describe("a project's mark", () => {
  it("has a fill for every colour upstream lets a project's icon wear", () => {
    expect(ProjectIconColor.literals.filter((color) => MADE_FILL[color] === undefined)).toEqual([]);
  });
});
