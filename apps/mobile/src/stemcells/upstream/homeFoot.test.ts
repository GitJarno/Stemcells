import { describe, expect, it } from "vite-plus/test";

import type { WorkspaceSearchMode } from "../../features/layout/workspace/workspace-tabs-state";
import { homeFoot } from "./homeFoot";

// The folded Duo's outer screen: the rail on the right, its lowest group ending 24 points up.
const folded = {
  width: 466,
  height: 678,
  hasHinge: true,
  horizontalSizeClass: "compact",
  verticalBarEdge: "right",
  safeArea: { top: 0, bottom: 20, left: 0, right: 84 },
  reservedRegions: [],
  bottomBarInset: 24,
} as const;

const foldedFoot = (searchMode: WorkspaceSearchMode, keyboardHeight = 0) =>
  homeFoot({
    deviceType: "duo-folded",
    insetsBottom: 20,
    column: folded,
    root: folded,
    searchMode,
    bottomClearance: 0,
    sidebarPicker: false,
    compactTabs: false,
    duoBar: 24,
    keyboardHeight,
    composerGutter: 6,
  });

describe("the home's foot on the folded Duo", () => {
  it("rests level with the rail's lowest group, the search being the rail's button", () => {
    expect(foldedFoot("resting")).toMatchObject({ rest: 24, pill: 24, notice: 24 });
  });

  it("rests over the search field once it opens at the foot", () => {
    expect(foldedFoot("active")).toMatchObject({ rest: 80, above: 64 });
  });

  it("stands level with the composer's foot over another field's keyboard", () => {
    expect(foldedFoot("resting", 300)).toMatchObject({ rest: 24, pill: 306, notice: 308 });
  });
});
