/**
 * What a header-less pane relies on in upstream: the chat's header carries
 * an attribute workspace.css can hide its contents by (the element stays, as
 * the thread panel's anchor), and the panel toggles carry the attribute
 * PaneButtons and workspace.css move them by. A failure here after a sync
 * names the contract that moved; a pane likely shows upstream's breadcrumb
 * again, or its toggles sit in the window's corner without the Look chip
 * and ×.
 */
import { describe, expect, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";

describe("the header-less pane's contracts with upstream", () => {
  it("the chat's header is one element holding the breadcrumb, anchoring the thread panel", () => {
    expect(chatView).toMatch(
      /<header\s+ref=\{threadPanelPopoverAnchorRef\}\s+data-chat-header\s[\s\S]*?<ChatHeader\b[\s\S]*?<\/header>/,
    );
  });

  it("the panel toggles sit in a fixed row marked as the titlebar's controls", () => {
    expect(chatView).toMatch(
      /"pointer-events-none fixed top-\[var\(--workspace-controls-top\)\] right-\[var\(--workspace-controls-right\)\] z-50 [^"]*",\s*\)\}\s*data-workspace-titlebar-controls\s*>/,
    );
    // The row goes beside the header or at the chat's root, both places
    // PaneButtons follows it to.
    expect(chatView).toContain(
      "{!rightPanelControlsAtRoot && !rightPanelControlsInPanel ? panelLayoutControls : null}",
    );
    expect(chatView).toContain("{rightPanelControlsAtRoot ? panelLayoutControls : null}");
  });
});
