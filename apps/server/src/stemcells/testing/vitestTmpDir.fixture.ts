// What `vitestTmpDir.test.ts` runs in a Vitest of its own: one test that
// loads a module, so Vitest has something to copy.
import { expect, it } from "vite-plus/test";

import { REMOVE_VITEST_TMP_DIR } from "./vitestTmpDir.ts";

it("loads a module", () => {
  expect(REMOVE_VITEST_TMP_DIR).toMatch(/^stemcells:/);
});
