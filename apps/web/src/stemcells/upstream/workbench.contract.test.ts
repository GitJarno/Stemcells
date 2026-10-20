/**
 * Upstream behaviour Look relies on (`workbench.ts`, `workbench/look.css`).
 * A failure here after a sync names the contract that moved; the fix goes
 * in this adapter or in Look's stylesheet, not in the tabs.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { beforeEach, describe, expect, expectTypeOf, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";
import panelLayoutControls from "../../components/chat/PanelLayoutControls.tsx?raw";
import mcpAppFrame from "../../components/chat/McpAppFrame.tsx?raw";
import threadFindBar from "../../components/chat/ThreadFindBar.tsx?raw";
import serverBrowser from "../../browser/ServerBrowserSurface.tsx?raw";
import hostedBrowser from "../../browser/HostedBrowserWebview.tsx?raw";
import composerEditor from "../../components/ComposerPromptEditorTiptap.tsx?raw";
import previewPanelShell from "../../components/preview/PreviewPanelShell.tsx?raw";
import resizeHandle from "../../components/preview/RightPanelResizeHandle.tsx?raw";
import dialog from "../../components/ui/dialog.tsx?raw";
import menu from "../../components/ui/menu.tsx?raw";
import popover from "../../components/ui/popover.tsx?raw";
import select from "../../components/ui/select.tsx?raw";
import sheet from "../../components/ui/sheet.tsx?raw";
import threadShell from "../../../../../packages/client-runtime/src/state/threadShell.ts?raw";
import { RESIZABLE_WIDTH_PROPERTY } from "../../hooks/useResizableWidth";
import { RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY } from "../../rightPanelLayout";
import {
  selectSelectedRightPanelSurface,
  selectThreadRightPanelState,
  useRightPanelStore,
} from "../../rightPanelStore";
import type { CellRef } from "../tabs/layout";
import { threadRefOf } from "./routes";
import { closeCellPanel, openCellPanel, surfaceName } from "./workbench";

const thread: CellRef = { environmentId: "env-look", threadId: "thread-look", draftId: null };
const asDraft: CellRef = { ...thread, draftId: "draft-look" };

beforeEach(() => {
  useRightPanelStore.setState({
    byThreadKey: {},
    threadPanelVisibilityByThreadKey: {},
    userActionRevisionByThreadKey: {},
    closeRevisionByThreadKey: {},
  });
});

const panel = (cell: CellRef) =>
  selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, threadRefOf(cell));

describe("Look's contracts with upstream's right panel", () => {
  it("closing keeps the panel's surfaces, and reopening shows the one it showed", () => {
    const ref = threadRefOf(thread);
    useRightPanelStore.getState().openFile(ref, "src/garden.ts");
    useRightPanelStore.getState().toggle(ref, "diff");
    expect(panel(thread).isOpen).toBe(true);

    closeCellPanel(thread);
    expect(panel(thread).isOpen).toBe(false);
    expect(panel(thread).surfaces.map((surface) => surface.id)).toEqual([
      "file:src/garden.ts",
      "diff",
    ]);
    expect(
      selectSelectedRightPanelSurface(useRightPanelStore.getState().byThreadKey, ref)?.id,
    ).toBe("diff");

    openCellPanel(thread);
    expect(panel(thread).isOpen).toBe(true);
    expect(panel(thread).activeSurfaceId).toBe("diff");
  });

  it("a draft's panel is its thread's, so sending the draft keeps Look's Cell", () => {
    useRightPanelStore.getState().toggle(threadRefOf(asDraft), "files");
    expect(panel(thread).isOpen).toBe(true);
  });

  it("closing a closed panel isn't a choice the user made", () => {
    const ref = threadRefOf(thread);
    const before = useRightPanelStore.getState().getUserActionRevision(ref);
    closeCellPanel(thread);
    expect(useRightPanelStore.getState().getUserActionRevision(ref)).toBe(before);
  });

  it("the chip names a surface as the panel's tab does", () => {
    const noPreview = () => null;
    expect(surfaceName({ id: "diff", kind: "diff" }, noPreview)).toBe("Diff");
    expect(
      surfaceName(
        {
          id: "file:src/garden.ts",
          kind: "file",
          relativePath: "src/garden.ts",
          revealLine: null,
          revealRequestId: 0,
        },
        noPreview,
      ),
    ).toBe("garden.ts");
    expect(
      surfaceName({ id: "browser:tab", kind: "preview", resourceId: "tab" }, () => ({
        _tag: "Success",
        url: "http://localhost:5173/",
        title: "",
      })),
    ).toBe("localhost:5173");
  });

  it("the thread view puts its panel in a sheet below upstream's breakpoint", () => {
    expect(RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY).toBe("(max-width: 980px)");
    expect(chatView).toContain(
      "const shouldUsePlanSidebarSheet = useMediaQuery(RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY);",
    );
  });
});

describe("what a send is", () => {
  it("the shell records when the user last wrote, apart from wakes and agents' messages", () => {
    expectTypeOf<EnvironmentThreadShell>().toHaveProperty("latestUserAuthoredMessageAt");
    expectTypeOf<EnvironmentThreadShell>().toHaveProperty("latestUserMessageAt");
  });

  it("the quiet shell passes a new message of the user's through while a run streams", () => {
    // The streaming ticks it ignores; the user's last message isn't one.
    expect(threadShell).toContain("function sameApartFromStreaming(");
    expect(threadShell).not.toMatch(/latestUser\w*MessageAt: after\./);
  });
});

describe("the DOM Look's stylesheet and Esc read", () => {
  it("the inline panel takes its width from a custom property, beside a resize separator", () => {
    expect(RESIZABLE_WIDTH_PROPERTY).toBe("--resizable-width");
    expect(previewPanelShell).toContain("data-preview-panel-mode={props.mode}");
    expect(previewPanelShell).toContain("width: `calc(var(${RESIZABLE_WIDTH_PROPERTY}) - 1px)`");
    expect(previewPanelShell).toContain("<RightPanelResizeHandle handlers={handlers} />");
    expect(resizeHandle).toContain('role="separator"');
  });

  it("the panel toggle sits in its own span among controls placed by --workspace-controls-right", () => {
    // look.css hides the toggle's span and moves its neighbours over by one
    // control (size-7) and the gap (gap-1), and the × takes its place.
    expect(panelLayoutControls).toMatch(
      /<TooltipTrigger render=\{<span className="flex shrink-0" \/>\}>\s*<Toggle[^>]*?data-right-panel-toggle/s,
    );
    expect(panelLayoutControls).toContain('size="sm"');
    expect(panelLayoutControls).toContain("items-center gap-1");
    expect(chatView).toContain("right-[var(--workspace-controls-right)] z-50 mr-px");
  });

  it("open overlays mark their popups; the find bar and a full-screen app view mark themselves", () => {
    for (const [source, slot] of [
      [dialog, "dialog-popup"],
      [sheet, "sheet-popup"],
      [popover, "popover-popup"],
      [menu, "menu-popup"],
      [select, "select-popup"],
    ] as const) {
      expect(source).toContain(`data-slot="${slot}"`);
    }
    expect(threadFindBar).toContain("data-thread-find-bar");
    expect(mcpAppFrame).toContain("data-mcp-app-fullscreen=");
  });

  it("a browser's page takes the keys: the desktop's in a webview, the server's in a field", () => {
    expect(hostedBrowser).toContain("<webview");
    expect(serverBrowser).toMatch(/<textarea\s+ref=\{inputRef\}\s+aria-label="Browser page"/);
  });

  it("the composer stops an Esc it uses, so the key never reaches the window", () => {
    expect(composerEditor).toMatch(
      /const handled = handler\(event\.key, event\);\s*if \(handled\) \{\s*event\.preventDefault\(\);\s*event\.stopPropagation\(\);/,
    );
  });
});
