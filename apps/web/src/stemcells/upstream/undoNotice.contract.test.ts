// @effect-diagnostics nodeBuiltinImport:off - reads upstream's components and Base UI's toast store from disk.
/**
 * What the rail's undo notice relies on upstream: after a settle (⌘⇧S), snooze, unpin, archive
 * or discarded draft, ⌘Z undoes it, even from the composer, said only in the wide sidebar. Under
 * the rail it would undo unseen, so the rail toasts the notice (`rail/undoNotice.ts`). When
 * upstream draws its notice where the rail shows, ours goes.
 */
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

import appSidebarLayoutSource from "../../components/AppSidebarLayout.tsx?raw";
import sidebarChromeSource from "../../components/sidebar/SidebarChrome.tsx?raw";
import sidebarListMarkersSource from "../../components/sidebar/SidebarListMarkers.tsx?raw";
import { isAppModalPage } from "../../components/sidebar/mainAppLocation";
import undoNoticeStoreSource from "../../hooks/showThreadUndoNotice.ts?raw";
import cellsSource from "../rail/Cells.tsx?raw";
import { litFor } from "../rail/lit";
import railSource from "../rail/Rail.tsx?raw";
import ourUndoNoticeSource from "./undoNotice.ts?raw";

const webSource = NodeURL.fileURLToPath(new URL("../..", import.meta.url));
const upstreamViews = NodeFS.readdirSync(webSource, { recursive: true })
  .map(String)
  .filter((file) => /\.tsx$/.test(file) && !file.startsWith("stemcells") && !/\.test\./.test(file));
const upstreamViewsDrawing = (element: string) =>
  upstreamViews
    .filter((file) => NodeFS.readFileSync(NodePath.join(webSource, file), "utf8").includes(element))
    .toSorted();
const baseUiToastStore = NodeFS.readFileSync(
  NodePath.join(
    NodePath.dirname(
      NodeModule.createRequire(import.meta.url).resolve("@base-ui/react/package.json"),
    ),
    "esm/toast/store.js",
  ),
  "utf8",
);

describe("upstream's undo notice", () => {
  it("is drawn only in the wide sidebar, which the rail stands in for", () => {
    // Over the list's first bottom shelf, or in the foot when no shelf hosts it.
    expect(upstreamViewsDrawing("<SidebarThreadUndoNotice")).toEqual([
      NodePath.join("components", "sidebar", "SidebarChrome.tsx"),
      NodePath.join("components", "sidebar", "SidebarListMarkers.tsx"),
    ]);
    expect(sidebarChromeSource).toContain("{showUndoNotice ? <SidebarThreadUndoNotice /> : null}");
    expect(sidebarListMarkersSource).toMatch(
      /\{props\.hostsUndoNotice \? \(\s*<SidebarThreadUndoNotice /,
    );
    expect(upstreamViewsDrawing("<SidebarChromeFooter")).toEqual([
      NodePath.join("components", "LegacySidebar.tsx"),
      NodePath.join("components", "Sidebar.tsx"),
    ]);
    expect(upstreamViewsDrawing("<SidebarSectionHeader")).toEqual([
      NodePath.join("components", "Sidebar.tsx"),
    ]);
  });

  it("claims ⌘Z from a text field whenever upstream's sidebar is open, as it is under the rail", () => {
    expect(appSidebarLayoutSource).toMatch(
      /isEditableFocused\(event\.target\) &&\s*!\(readSidebarVisible\(\) && threadUndoClaimsShortcut\(\)\),/,
    );
    // Open is the sidebar wrapper's state, which the rail, inside upstream's sidebar, keeps.
    expect(appSidebarLayoutSource).toMatch(
      /const readSidebarVisible = \(\) =>\s*shellElement\.closest\('\[data-slot="sidebar-wrapper"\]'\)\?\.getAttribute\("data-sidebar-state"\) ===\s*"expanded";/,
    );
    // Not on Settings or Usage: the rail's toast stays off there too.
    expect(appSidebarLayoutSource).toContain(
      "const threadSidebarShown = () => !isAppModalPage(router.state.location.pathname);",
    );
    expect(appSidebarLayoutSource).toMatch(/capture: true,\s*when: threadSidebarShown,/);
  });

  it("is one store the rail reads, which empties when it times out or is undone", () => {
    expect(undoNoticeStoreSource).toContain(
      "export const useThreadUndoNotice = create<{ notice: UndoNotice | null }>(() => ({ notice: null }));",
    );
    expect(undoNoticeStoreSource).toMatch(
      /type UndoNotice = \{\s*action: UndoOptions\["action"\];\s*count: number;/,
    );
    expect(undoNoticeStoreSource).toMatch(
      /expiry = setTimeout\(\(\) => \{[\s\S]{0,250}refreshNotice\(\);\s*\}, /,
    );
    expect(undoNoticeStoreSource).toMatch(
      /export function undoLatestThreadAction\(\): boolean \{\s*const notice = useThreadUndoNotice\.getState\(\)\.notice;/,
    );
  });
});

describe("the rail's undo toast", () => {
  it("has no timer of its own: a toast added with timeout 0 stays until it is closed", () => {
    expect(ourUndoNoticeSource).toMatch(/id: UNDO_TOAST_ID,\s*title,\s*timeout: 0,/);
    expect(baseUiToastStore).toMatch(
      /const duration = toastToAdd\.timeout \?\? timeout;\s*if \(toastToAdd\.type !== 'loading' && duration > 0\) \{/,
    );
  });

  it("shows while the rail does, off Settings and Usage, as upstream's ⌘Z claim does", () => {
    for (const column of [railSource, cellsSource]) {
      expect(column).toContain("useRailUndoNotice(open && lit === null);");
    }
    for (const path of [
      "/",
      "/env/thread",
      "/pull-requests",
      "/settings",
      "/settings/disk",
      "/usage",
    ]) {
      expect(litFor(path) === null, path).toBe(!isAppModalPage(path));
    }
  });
});
