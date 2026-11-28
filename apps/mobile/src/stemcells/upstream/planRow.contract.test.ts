import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

/**
 * Contract: what a plan's row leans on in upstream's own files (`planRow.ts`, `planPick.ts`,
 * `aski/plan/PlanRow.tsx`), which the type checker can't hold: a full swipe that only toggles
 * leaves its row in place, the swipe gives way to a scroll, and the root stack takes our sheet.
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const source = (path: string) => NodeFS.readFileSync(NodePath.join(here, path), "utf8");

describe("what a plan's row leans on upstream", () => {
  const swipe = source("../../features/home/thread-swipe-actions.tsx");

  it("runs a full swipe's primary action and closes the row where it stands", () => {
    expect(swipe).toContain('if (fullSwipeAction === "primary") commitPrimaryAction();');
    expect(swipe).toMatch(
      /primaryAction\.onPress\(\);\s+if \(!pendingDismissRef\.current\) swipeableRef\.current\?\.close\(\);/,
    );
    // Only a row told to leave on release slides out: a task switched off stays.
    expect(swipe).toContain("if (leavesOnRelease) dismiss(translation, 0);");
  });

  it("gives a vertical drag to the list, and draws no action on a dormant row", () => {
    expect(swipe).toContain("const FAIL_OFFSET_Y: [number, number] = [-10, 10];");
    expect(swipe).toContain("failOffsetY={FAIL_OFFSET_Y}");
    expect(swipe).toContain("const element = dormant ? null : (");
  });

  it("opens the composer's model sheet as the route options ours copies, on a root stack that takes our routes", () => {
    const stack = source("../../Stack.tsx");
    expect(stack).toMatch(
      /const THREAD_SETTINGS_ROUTE = pickSheet\(\s+sheetRoute\(\{\s+detent: "full",\s+header: "none",\s+android: "card",\s+spansRail: true,\s+\}\),\s+\);/,
    );
    expect(stack).toContain("...stemcellsSettingsScreens(settingsPage),");
    expect(stack).toMatch(/screens: \{[\s\S]*\.\.\.SETTINGS_SCREENS,/);
  });
});
