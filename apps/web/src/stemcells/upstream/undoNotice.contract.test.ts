// @effect-diagnostics nodeBuiltinImport:off - reads upstream's components and Base UI's toast store from disk.
/**
 * What the column's undo line relies on upstream: after an unpin, archive or discarded draft,
 * ⌘Z undoes it, even from the composer, said only in the wide sidebar. The column draws it as a
 * line (`rail/UndoLine.tsx`); the rail, or the column hidden, toasts it (`rail/undoNotice.ts`).
 * A settle or snooze shows none: its undo is let go as it lands (`substitutes/useThreadActions.ts`).
 */
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import * as ThreadUndo from "@t3tools/client-runtime/state/thread-undo";
import { AsyncResult } from "effect/reactivity";
import { describe, expect, it, vi } from "vite-plus/test";

import appSidebarLayoutSource from "../../components/AppSidebarLayout.tsx?raw";
import sidebarChromeSource from "../../components/sidebar/SidebarChrome.tsx?raw";
import { isAppModalPage } from "../../components/sidebar/mainAppLocation";
import {
  showThreadUndoNotice,
  threadUndoClaimsShortcut,
  undoLatestThreadAction,
  useThreadUndoNotice,
} from "../../hooks/showThreadUndoNotice";
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
    "toast/store.mjs",
  ),
  "utf8",
);

describe("upstream's undo notice", () => {
  it("is drawn only in the wide sidebar, which the rail stands in for", () => {
    // In the sidebar's foot, over its update pill.
    expect(upstreamViewsDrawing("<SidebarThreadUndoNotice")).toEqual([
      NodePath.join("components", "sidebar", "SidebarChrome.tsx"),
    ]);
    expect(sidebarChromeSource).toMatch(/<SidebarThreadUndoNotice \/>\s*<SidebarUpdatePill \/>/);
    expect(upstreamViewsDrawing("<SidebarChromeFooter")).toEqual([
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

describe("a settle's undo let go as it lands", () => {
  it("takes upstream's notice and its ⌘Z away at once, and never runs the undo", () => {
    const undo = vi.fn(async () => AsyncResult.success(undefined));
    showThreadUndoNotice({
      action: "Settled",
      claim: ThreadUndo.begin("settle", "environment:thread"),
      undo,
      failureTitle: "",
    });
    expect(useThreadUndoNotice.getState().notice?.action).toBe("Settled");
    ThreadUndo.invalidate("settle", "environment:thread");
    expect(useThreadUndoNotice.getState().notice).toBeNull();
    expect(threadUndoClaimsShortcut()).toBe(false);
    expect(undoLatestThreadAction()).toBe(false);
    expect(undo).not.toHaveBeenCalled();
  });
});

describe("the rail's undo toast", () => {
  it("has no timer of its own: a toast added with timeout 0 stays until it is closed", () => {
    expect(ourUndoNoticeSource).toMatch(/id: UNDO_TOAST_ID,\s*title,\s*timeout: 0,/);
    expect(baseUiToastStore).toMatch(
      /const duration = toastToAdd\.timeout \?\? timeout;\s*if \(toastToAdd\.type !== 'loading' && duration > 0\) \{/,
    );
  });

  it("shows while the rail does, or the column is hidden, off Settings and Usage, as upstream's ⌘Z claim does", () => {
    expect(railSource).toContain("useRailUndoNotice(open && lit === null);");
    expect(cellsSource).toContain("useRailUndoNotice(!open && lit === null);");
    expect(cellsSource).toMatch(/<nav data-cells-stages="" aria-label="Stages">\s*<UndoLine \/>/);
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
