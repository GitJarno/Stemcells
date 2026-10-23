// @effect-diagnostics nodeBuiltinImport:off - reads upstream's stylesheet on disk.
/**
 * What a header-less pane relies on in upstream: the chat's header carries
 * an attribute workspace.css can hide its contents by (the element stays, as
 * the thread panel's anchor), and the panel toggles carry the attribute
 * PaneButtons and workspace.css move them by. A failure here after a sync
 * names the contract that moved; a pane likely shows upstream's breadcrumb
 * again, or its toggles sit in the window's corner without the Look chip
 * and ×. The transcript clears the buttons by upstream's top fade, whose
 * height a pane sets to its button band; if that moved, the buttons cover
 * the chat's first message.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";
import messagesTimeline from "../../components/chat/MessagesTimeline.tsx?raw";
import panelLayoutControls from "../../components/chat/PanelLayoutControls.tsx?raw";
import cellWorkspace from "../tabs/CellWorkspace.tsx?raw";

/** CSS imports come in empty under test; the stylesheet is read as text. */
const appStyles = NodeFS.readFileSync(new URL("../../index.css", import.meta.url), "utf8");

describe("the header-less pane's contracts with upstream", () => {
  it("the chat's header is one element holding the breadcrumb, anchoring the thread panel", () => {
    expect(chatView).toMatch(
      /<header\s+ref=\{threadPanelPopoverAnchorRef\}\s+data-chat-header\s[\s\S]*?<ChatHeader\b[\s\S]*?<\/header>/,
    );
  });

  it("the panel toggles sit in a fixed row marked as the titlebar's controls", () => {
    expect(panelLayoutControls).toMatch(
      /className="pointer-events-none fixed top-\[var\(--workspace-controls-top\)\] right-\[var\(--workspace-controls-right\)\] z-50 [^"]*"\s*data-workspace-titlebar-controls\s*>/,
    );
    expect(chatView).toMatch(/const panelLayoutControls = \(\s*<WorkspaceTitlebarControls\b/);
    // The row goes beside the header or at the chat's root, both places
    // PaneButtons follows it to.
    expect(chatView).toContain(
      "{!rightPanelControlsAtRoot && !rightPanelControlsInPanel ? panelLayoutControls : null}",
    );
    expect(chatView).toContain("{rightPanelControlsAtRoot ? panelLayoutControls : null}");
    // Maximize stays in the row while the right panel is closed, out of
    // reach; the … menu leaves out what is inert.
    expect(panelLayoutControls).toContain("inert={!props.rightPanelOpen}");
  });

  it("with the right panel open the toggles split in two rows, which every pane spaces", () => {
    // The thread details toggle stays by the header; the rest go to the root.
    // A pane that doesn't measure the root's row (--sc-pane-row) lays the
    // thread details toggle over the right panel's. Aski's pane shows no
    // toggles at all (aski/room.css).
    expect(chatView).toContain(
      "const threadPanelHeaderControl = <ThreadPanelHeaderControl {...panelToggleControlProps} />;",
    );
    expect(panelLayoutControls).toMatch(
      /export function ThreadPanelHeaderControl\([\s\S]*?showTerminalControl=\{false\}\s*showRightPanelControl=\{false\}/,
    );
    expect(cellWorkspace).toMatch(/<PaneButtons\s/);
  });

  it("the transcript opens below a spacer, and fades under it, both as tall as one height", () => {
    expect(messagesTimeline).toMatch(
      /const TIMELINE_LIST_FADE_HEADER = \(\s*<div className="h-\[var\(--workspace-titlebar-scroll-fade-height\)\]" \/>/,
    );
    expect(messagesTimeline).toContain('"messages-timeline-scroll ');
    expect(messagesTimeline).toContain('topFadeEnabled && "topbar-scroll-fade"');
    expect(appStyles).toMatch(
      /@utility topbar-scroll-fade \{[^}]*mask-size:\s*100% calc\(var\(--workspace-titlebar-scroll-fade-height\) \+ 1px\)/,
    );
  });
});
