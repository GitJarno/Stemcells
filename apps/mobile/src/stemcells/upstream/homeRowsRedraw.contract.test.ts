import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { expect, it } from "vite-plus/test";

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const home = NodePath.resolve(here, "../../features/home/HomeScreen.tsx");

/**
 * Contract: LegendList redraws a row only when its item or `extraData` changes, never for a new
 * `renderItem`. The home's rows take their pane and swipe width through `renderItem`, so a fold,
 * an unfold or a turn left the rows whose Cells sat still in the old shape (`seams/mobile.md`).
 */
it("hands the home's list its pane and swipe width as extraData", () => {
  const source = NodeFS.readFileSync(home, "utf8");
  const extra = /const v2ExtraData = \{([^}]*)\};/.exec(source)?.[1] ?? "";
  expect(extra).toMatch(/\bsidebarSurface,/);
  expect(extra).toMatch(/\bfullSwipeWidth,/);
});
