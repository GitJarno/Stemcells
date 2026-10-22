// @effect-diagnostics nodeBuiltinImport:off - reads upstream's components and Base UI's toast store from disk.
/**
 * What the rail's undo notice relies on upstream. After a settle (⌘⇧S), a
 * snooze, an unpin, an archive or a discarded draft, upstream lets ⌘Z undo
 * it, even from the composer, and says so only in the wide sidebar. Under
 * the rail, ⌘Z would undo unseen, so the rail shows the notice as a toast
 * (`rail/undoNotice.ts`). A failure here after a sync names what moved; when
 * upstream draws its notice where the rail shows, ours goes.
 */
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

import appSidebarLayoutSource from "../../components/AppSidebarLayout.tsx?raw";
import sidebarChromeSource from "../../components/sidebar/SidebarChrome.tsx?raw";
import undoNoticeStoreSource from "../../hooks/showThreadUndoNotice.ts?raw";
import railSource from "../rail/Rail.tsx?raw";
import ourUndoNoticeSource from "./undoNotice.ts?raw";

const webSource = NodeURL.fileURLToPath(new URL("../..", import.meta.url));
const upstreamFilesDrawingTheNotice = NodeFS.readdirSync(webSource, { recursive: true })
  .map(String)
  .filter((file) => /\.tsx$/.test(file) && !file.startsWith("stemcells") && !/\.test\./.test(file))
  .filter((file) =>
    NodeFS.readFileSync(NodePath.join(webSource, file), "utf8").includes(
      "<SidebarThreadUndoNotice",
    ),
  );
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
  it("is drawn only in the wide sidebar's foot, which the rail stands in for", () => {
    expect(upstreamFilesDrawingTheNotice).toEqual([
      NodePath.join("components", "sidebar", "SidebarChrome.tsx"),
    ]);
    expect(sidebarChromeSource).toContain("<SidebarThreadUndoNotice />");
  });

  it("claims ⌘Z from a text field whenever upstream's sidebar is open, as it is under the rail", () => {
    expect(appSidebarLayoutSource).toContain("const noticeVisible = useSidebarVisibility();");
    expect(appSidebarLayoutSource).toContain(
      "isEditableFocused(event.target) && !(noticeVisible && threadUndoClaimsShortcut()),",
    );
    // Not on Settings: the rail's toast stays off there too.
    expect(appSidebarLayoutSource).toContain("{isOnSettings ? null : <ThreadUndoShortcut />}");
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

  it("shows while the rail does, off Settings", () => {
    expect(railSource).toContain(
      'useRailUndoNotice(open && lit !== "settings" && lit !== "disk");',
    );
  });
});
