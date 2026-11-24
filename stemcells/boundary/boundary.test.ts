import * as NodePath from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { sharedBoundaryOf } from "./check.ts";

/** What our root folder reads of upstream's, each with why. Nothing joins it without one. */
const KNOWN = [
  // Pins our seams in upstream's build script, which no app's folder of ours holds.
  'brand/releaseNames.test.ts imports "../../scripts/build-desktop-artifact.ts": upstream app code (relative path)',
  // Pins our seam in the loader every build reads its public configuration through.
  'privacy/closed.test.ts imports "../../scripts/lib/public-config.ts": upstream app code (relative path)',
];

describe("Stemcells' boundary with upstream, at the repository's root", () => {
  it("the code every app shares imports nothing of upstream's", () => {
    const root = NodePath.dirname(import.meta.dirname);
    expect(sharedBoundaryOf(root).violations()).toEqual(KNOWN);
  });
});
