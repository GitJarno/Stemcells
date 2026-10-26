/**
 * What Aski's place in its chat relies on in upstream, besides what the
 * composer line already pins (`composerLine.contract.test.ts`: the line's
 * spot stands before the composer's plate, in the overlay the transcript
 * keeps clear). A failure here after a sync names the contract that moved;
 * Aski likely floats over upstream's "Send a message" hint, floats at the
 * wrong height, or perches in a chat that hasn't started; or the needs
 * sheet opens under the transcript's minimap.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";
import chatCanvas from "../../components/chat/ChatCanvas.tsx?raw";
import timeline from "../../components/chat/MessagesTimeline.tsx?raw";
import minimap from "../../components/chat/TimelineMinimap.tsx?raw";

describe("Aski's place in its chat, against upstream", () => {
  it("the empty transcript's hint is one paragraph in a centring box, which perch.css hides", () => {
    expect(timeline).toMatch(
      /className="flex h-full items-center justify-center[^"]*"[\s\S]{0,200}?>\s*<p className="text-sm text-muted-foreground\/30">\s*Send a message to start the conversation\.\s*<\/p>\s*<\/div>/,
    );
  });

  it("the chat's canvas and its composer's overlay name themselves, so Aski measures its rise", () => {
    expect(chatCanvas).toContain("data-chat-canvas");
    expect(chatView).toContain('data-chat-composer-overlay="true"');
  });

  it("the transcript's minimap lies at 40, which the needs sheet lies over", () => {
    expect(minimap).toContain('"group/minimap pointer-events-none absolute inset-y-0 left-0 z-40 ');
  });

  it("a chat never sent anything has no latest run", () => {
    expectTypeOf<null>().toExtend<EnvironmentThreadShell["latestRun"]>();
  });
});
