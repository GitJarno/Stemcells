// @effect-diagnostics nodeBuiltinImport:off - reads the stylesheet on disk.
/**
 * Upstream behaviour the slate's one ground relies on (tabs/workspace.css): a pane's chat is
 * upstream's inset, `bg-background` under its grain, holding ChatView's root and the timeline's
 * wrapper, each `bg-background` and slate-sized. The sheet clears all three; a failure after a
 * sync names the layer that moved, which may paint its own ground over the slate again.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import chatCanvas from "../../components/chat/ChatCanvas.tsx?raw";
import threadFind from "../../components/chat/ThreadFindProvider.tsx?raw";
import threadTimeline from "../../components/chat/ThreadTimeline.tsx?raw";
import chatView from "../../components/ChatView.tsx?raw";
import threadRouteView from "../../components/ThreadRouteView.tsx?raw";
import sidebar from "../../components/ui/sidebar.tsx?raw";

const workspaceCss = NodeFS.readFileSync(new URL("../tabs/workspace.css", import.meta.url), "utf8");
const appStyles = NodeFS.readFileSync(new URL("../../index.css", import.meta.url), "utf8");

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
    expect(threadRouteView).toMatch(
      /<SidebarInset\s[^>]*>\s*<BackgroundThreadContext value=\{background\}>\{view\}<\/BackgroundThreadContext>\s*<\/SidebarInset>/,
    );
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
    // ThreadTimeline renders the timeline itself, with no box of its own.
    expect(chatView).toMatch(
      /\n {10}<ThreadFindCanvas[\s\S]*?\n {12}<div className="relative flex min-h-0 flex-1 flex-col bg-background">\s*<ThreadTimeline/,
    );
    expect(threadTimeline).toMatch(/return <MessagesTimeline [^>]*\/>;/);
    expect(threadFind).toContain("<ChatCanvas {...canvasProps} />");
    expect(chatCanvas).toMatch(/data-chat-canvas[\s\S]*?\{children\}\s*<\/div>/);
  });
});

describe("the new design's black canvas stays off the slate", () => {
  it("upstream blackens only its own dark theme, whose canvas was neutral-950", () => {
    expect(appStyles).toMatch(
      /\nhtml\.dark\[data-redesign\]:not\(\[data-theme-id\]\) \{\s*--background: #000;/,
    );
    expect(appStyles).toMatch(/@variant dark \{[^}]*?--background: var\(--color-neutral-950\);/);
  });

  it("the slate takes the canvas back under the same selector", () => {
    expect(workspaceCss).toMatch(
      /:root\.dark\[data-redesign\]:not\(\[data-theme-id\]\) \[data-stemcells-slate\] \{\s*--background: var\(--color-neutral-950\);\s*\}/,
    );
  });
});
