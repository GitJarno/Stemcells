/**
 * What the line over a Cell's composer relies on in upstream: that it rides
 * in the composer's flow, inside the overlay whose height the transcript
 * keeps clear at its foot, and that a wheel over the composer reaches it. A
 * failure here after a sync names the contract that moved; the line likely
 * covers the transcript's last row, or a wheel over it stops at the plate.
 */
import { describe, expect, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";
import chatComposer from "../../components/chat/ChatComposer.tsx?raw";
import composerBanner from "../../components/chat/ComposerBanner.tsx?raw";

describe("the composer line's contracts with upstream", () => {
  it("is the first thing in the composer's banner column, in its flow", () => {
    expect(chatComposer).toMatch(
      /<ComposerBanner\.Dock>\s*<ComposerBanner\.Column>\s*<CellComposerLine \/>/,
    );
    // The column stacks its attachments; nothing in it floats out of the flow.
    expect(composerBanner).toMatch(/function Column\b[\s\S]*?"flex min-w-0 flex-1 flex-col /);
  });

  it("the transcript keeps the height of the overlay the line is in clear at its foot", () => {
    // ChatView measures the overlay holding the composer, line and all, and
    // reserves that height under the transcript's last row.
    expect(chatView).toMatch(
      /ref=\{setComposerOverlayElement\}[\s\S]*?data-chat-composer-overlay="true"[\s\S]*?<ChatComposer\b/,
    );
    expect(chatView).toContain(
      "publishComposerOverlayHeightStable(composerOverlayElement.getBoundingClientRect().height);",
    );
    expect(chatView).toMatch(/const nextInset = resolveComposerTimelineInset\(\{/);
  });

  it("a wheel over the composer lands on its stack, over the transcript", () => {
    // The overlay lets the pointer through to the transcript; its stack takes
    // it back, and `scrollThrough` passes a vertical wheel on.
    expect(chatView).toMatch(
      /data-chat-composer-overlay="true"[\s\S]{0,300}?"pointer-events-none absolute inset-x-0 bottom-0/,
    );
    expect(chatView).toMatch(
      /data-chat-composer-stack="true"\s+className="[^"]*\bpointer-events-auto\b/,
    );
  });
});
