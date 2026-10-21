// @effect-diagnostics nodeBuiltinImport:off - reads the stylesheet on disk.
/**
 * Upstream behaviour the slate's one ground relies on (tabs/workspace.css):
 * a pane's chat is upstream's inset, painted `bg-background` under its
 * grain, holding ChatView's root and, in the chat's canvas, the timeline's
 * wrapper, each `bg-background` again and each the size of the slate. The
 * sheet clears all three, so a chat paints nothing over the slate. A
 * failure after a sync names the layer that moved: a chat may paint its own
 * ground over the slate again.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import chatCanvas from "../../components/chat/ChatCanvas.tsx?raw";
import threadFind from "../../components/chat/ThreadFindProvider.tsx?raw";
import chatView from "../../components/ChatView.tsx?raw";
import threadRouteView from "../../components/ThreadRouteView.tsx?raw";
import sidebar from "../../components/ui/sidebar.tsx?raw";

const workspaceCss = NodeFS.readFileSync(new URL("../tabs/workspace.css", import.meta.url), "utf8");

const CLEARED = [
  '[data-stemcells-pane] [data-slot="sidebar-inset"]',
  '[data-stemcells-pane] [data-slot="sidebar-inset"] > .bg-background',
  "[data-stemcells-pane] [data-chat-canvas] > .bg-background",
];

describe("a chat paints nothing over the slate", () => {
  it("the sheet clears the inset, ChatView's root and the timeline's wrapper", () => {
    const rules = [...workspaceCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
      ([, selectors, body]) => ({
        selectors: selectors!
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .split(",")
          .map((selector) => selector.trim().replace(/\s+/g, " ")),
        body: body!.trim(),
      }),
    );
    const clearing = rules.find((rule) => CLEARED.every((s) => rule.selectors.includes(s)));
    expect(clearing?.body).toBe("background: none;");
  });

  it("a pane's chat is upstream's inset, its ground under its grain", () => {
    expect(threadRouteView).toMatch(/<SidebarInset [^>]*>\s*\{view\}\s*<\/SidebarInset>/);
    expect(sidebar).toMatch(
      /<main\s+className=\{cn\(\s*"relative flex min-w-0 w-full flex-1 flex-col bg-background surface-grain",[\s\S]*?\)\}\s+data-slot="sidebar-inset"/,
    );
  });

  it("ChatView's root, the inset's child, paints the ground again", () => {
    expect(chatView).toMatch(
      /const content = \(\s*<div\s+ref=\{setWorkspaceLayoutElement\}\s+className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background"/,
    );
  });

  it("so does the timeline's wrapper, a child of the chat's canvas", () => {
    // At the canvas's own depth in ChatView: a child of ThreadFindCanvas,
    // which renders upstream's ChatCanvas, whose canvas holds its children.
    expect(chatView).toMatch(
      /\n {10}<ThreadFindCanvas[\s\S]*?\n {12}<div className="relative flex min-h-0 flex-1 flex-col bg-background">\s*<MessagesTimeline/,
    );
    expect(threadFind).toContain("<ChatCanvas {...canvasProps} />");
    expect(chatCanvas).toMatch(/data-chat-canvas[\s\S]*?\{children\}\s*<\/div>/);
  });
});
