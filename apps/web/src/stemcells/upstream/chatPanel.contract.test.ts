/**
 * Upstream behaviour the workbench relies on. A failure here after a sync
 * names the contract that moved; the fix goes in `chatPanel.tsx` or in the
 * seam, not in the tabs.
 */
import { describe, expect, it } from "vite-plus/test";

import { SUBSTITUTES } from "./substitutes/plugin";

import chatView from "../../components/ChatView.tsx?raw";
import chatRightPanel from "../../components/chat/ChatRightPanel.tsx?raw";
import previewPanelShell from "../../components/preview/PreviewPanelShell.tsx?raw";
import rightPanelTabs from "../../components/RightPanelTabs.tsx?raw";
import chatCanvas from "../../components/chat/ChatCanvas.tsx?raw";
import messagesTimeline from "../../components/chat/MessagesTimeline.tsx?raw";

describe("the workbench's contracts with upstream", () => {
  it("the thread view draws its panel and sheet through our adapter", () => {
    // Substitutes for upstream's panel and sheet modules hand the thread view
    // ours (the substitutes contract test proves it for every build). Without
    // them every pane would draw a panel of its own.
    expect(SUBSTITUTES).toMatchObject({
      "apps/web/src/components/RightPanelTabs.tsx": "RightPanelTabs.tsx",
      "apps/web/src/components/RightPanelSheet.tsx": "RightPanelSheet.tsx",
    });
    expect(chatRightPanel).toContain('mode="inline"');
  });

  it("the panel marks its mode and its maximized state for the slate's stylesheet", () => {
    // workspace.css hides the chats while the workbench is maximized, and
    // keeps a chat's column whose panel is maximized elsewhere.
    expect(previewPanelShell).toContain("data-preview-panel-maximized");
    expect(chatView).toContain("data-chat-column-maximized-away");
  });

  it("the thread view hands its panel whether it is maximized, and the panel draws it so", () => {
    // ChatPanelTabs tells the page from that prop (PanelMaximizedContext), and
    // workspace.css then gives the workbench the page, with no `:has()`.
    // Upstream draws the inline panel in ChatRightPanel, which the thread view hands it to.
    expect(chatView).toMatch(/<ChatRightPanel\s[^>]{0,600}maximized=\{rightPanelMaximized\}/);
    expect(chatRightPanel).toContain(
      '<RightPanelTabs {...tabs} mode="inline" maximized={maximized}',
    );
    expect(rightPanelTabs).toContain(
      "{...(props.maximized !== undefined ? { maximized: props.maximized } : {})}",
    );
  });

  it("the panel toggles carry the attribute the slate hides in unfocused panes", () => {
    expect(chatView).toContain("data-workspace-titlebar-controls");
  });

  it("the lanes the panes narrow still carry upstream's class names", () => {
    // workspace.css narrows the padding of these lanes inside a narrow pane.
    expect(chatView).toContain("chat-composer-lane");
    expect(messagesTimeline).toContain("messages-timeline-scroll");
    expect(chatCanvas).toContain("data-chat-canvas");
  });
});
