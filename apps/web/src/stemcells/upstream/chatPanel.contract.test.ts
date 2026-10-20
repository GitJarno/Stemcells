/**
 * Upstream behaviour the workbench relies on. A failure here after a sync
 * names the contract that moved; the fix goes in `chatPanel.tsx` or in the
 * seam, not in the tabs.
 */
import { describe, expect, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";
import previewPanelShell from "../../components/preview/PreviewPanelShell.tsx?raw";
import chatCanvas from "../../components/chat/ChatCanvas.tsx?raw";
import messagesTimeline from "../../components/chat/MessagesTimeline.tsx?raw";

describe("the workbench's contracts with upstream", () => {
  it("the thread view draws its panel and sheet through our adapter", () => {
    // The seam: two imports in the thread view. A sync that resolved a
    // conflict there in upstream's favour would put a panel back in every pane.
    expect(chatView).toContain(
      'import { ChatPanelTabs as RightPanelTabs } from "../stemcells/upstream/chatPanel";',
    );
    expect(chatView).toContain(
      'import { ChatPanelSheet as RightPanelSheet } from "../stemcells/upstream/chatPanel";',
    );
    expect(chatView).toContain('mode="inline"');
  });

  it("the panel marks its mode and its maximized state for the slate's stylesheet", () => {
    // workspace.css hides the chats while the workbench is maximized, and
    // keeps a chat's column whose panel is maximized elsewhere.
    expect(previewPanelShell).toContain("data-preview-panel-maximized");
    expect(chatView).toContain("data-chat-column-maximized-away");
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
