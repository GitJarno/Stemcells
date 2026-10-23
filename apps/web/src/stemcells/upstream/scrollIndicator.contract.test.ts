// @effect-diagnostics nodeBuiltinImport:off - reads upstream's source files on disk.
/**
 * What the chat's scroll indicator (`scrollIndicator/`) relies on in
 * upstream: T3's ask marks (its timeline minimap), found by the attributes
 * upstream's own code and tests find them by, whichever file draws them. A
 * failure here after a sync names the contract that moved: the marks may
 * show at rest again, never show, or stand at the left.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";
import messagesTimeline from "../../components/chat/MessagesTimeline.tsx?raw";
import threadTimeline from "../../components/chat/ThreadTimeline.tsx?raw";

const webSource = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "../..",
);

/** Upstream's web views, by path: everything under src/ but our folder and the tests. */
function readUpstreamViews(): ReadonlyMap<string, string> {
  const files = new Map<string, string>();
  for (const entry of NodeFS.readdirSync(webSource, { recursive: true })) {
    const path = String(entry);
    if (path.startsWith(`stemcells${NodePath.sep}`)) continue;
    if (!path.endsWith(".tsx") || path.endsWith(".test.tsx")) continue;
    files.set(path, NodeFS.readFileSync(NodePath.join(webSource, path), "utf8"));
  }
  return files;
}

/** The one view that draws the marks, and its source. */
function marksView(): string {
  const views = [...readUpstreamViews()].filter(([, source]) =>
    source.includes('data-testid="timeline-minimap"'),
  );
  expect(views.map(([path]) => path)).toHaveLength(1);
  return views[0]![1];
}

describe("the chat's scroll indicator, against upstream", () => {
  it("the marks' box carries the test id the indicator finds it by, and hides by its own opacity", () => {
    const marks = marksView();
    const box = marks.slice(0, marks.indexOf('data-testid="timeline-minimap"'));
    // scrollIndicator.css takes over the box's opacity: upstream shows it
    // always where the lane has room, and under the hand where it hasn't.
    expect(box.slice(box.lastIndexOf("<div"))).toMatch(
      /hasPersistentGutter\s*\?\s*"opacity-100"\s*:\s*"opacity-0 [^"]*hover:opacity-100 focus-within:opacity-100"/,
    );
  });

  it("the preview opens inside the marks' box, by an attribute upstream's code finds it by", () => {
    const marks = marksView();
    const box = marks.indexOf('data-testid="timeline-minimap"');
    const preview = marks.indexOf("data-minimap-preview\n");
    expect(box).toBeGreaterThan(-1);
    expect(preview).toBeGreaterThan(box);
    expect(marks).toContain('target.closest("[data-minimap-preview]")');
  });

  it("the transcript scrolls under the class the indicator hears it by, beside the chat's marks", () => {
    expect(messagesTimeline).toContain('"messages-timeline-scroll ');
    expect(messagesTimeline).toContain("<TimelineMinimap");
    expect(chatView.match(/<ThreadTimeline\b/g)).toHaveLength(1);
    expect(threadTimeline.match(/<MessagesTimeline\b/g)).toHaveLength(1);
  });

  it("the composer floats in an overlay whose keys and presses aren't a reader's scroll", () => {
    expect(chatView).toContain('data-chat-composer-overlay="true"');
  });
});
