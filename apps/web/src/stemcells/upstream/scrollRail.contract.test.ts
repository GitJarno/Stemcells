/**
 * What the scroll rail relies on in upstream (`scrollRail/`). A failure
 * here after a sync names the contract that moved: the system's bar may
 * draw over a chat or the settings again, the rail may run under the
 * composer, or T3's ask marks may fall back to the left or stand in the
 * rail's way.
 */
import { describe, expect, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";
import messagesTimeline from "../../components/chat/MessagesTimeline.tsx?raw";
import minimapWheel from "../../components/chat/timelineMinimapWheel.ts?raw";
import settingsLayout from "../../components/settings/settingsLayout.tsx?raw";

describe("the scroll rail, against upstream", () => {
  it("the transcript scrolls itself under the class the rail finds it by", () => {
    // scrollRail.css hides its bar; ScrollRail.tsx reads its extent.
    expect(messagesTimeline).toContain(
      '"messages-timeline-scroll scrollbar-gutter-both h-full min-h-0 overflow-x-hidden',
    );
  });

  it("a settings page scrolls itself under the attribute the rail finds it by", () => {
    expect(settingsLayout).toContain(
      '"topbar-scroll-fade scrollbar-gutter-both flex-1 overflow-y-auto"\n        data-settings-page-scroll',
    );
  });

  it("the composer floats over the transcript's foot, where the rail stops short of it", () => {
    expect(chatView).toContain('data-chat-composer-overlay="true"');
    expect(chatView).toContain('"pointer-events-none absolute inset-x-0 bottom-0 z-20');
  });

  it("the chat's column scrolls unless clipped, which scrollRail.css does in a pane", () => {
    expect(chatView).toContain(
      '"flex min-h-0 min-w-0 flex-col overflow-x-hidden",\n          rightPanelMaximized ? "w-0 flex-none" : "flex-1",\n        )}\n        data-chat-column-maximized-away={rightPanelMaximized ? "true" : "false"}\n        data-chat-column',
    );
  });

  it("a press whose target is the transcript itself is a scroll bar's, and stops the follow", () => {
    // ScrollRail.tsx sends one when the rail is pressed, as a press on a
    // native bar would, so a reply streaming in doesn't pull the hand down.
    expect(chatView).toContain("Scrollbar drags produce no wheel/touch events");
    expect(chatView).toMatch(
      /const handlePointerDown = \(event: PointerEvent\) => \{\n\s+if \(event\.target === scrollNode\) \{\n\s+if \(contentScrollsUp\(\)\) \{\n\s+handleManualNavigation\(\);/,
    );
    expect(chatView).toContain('scrollNode.addEventListener("pointerdown", handlePointerDown');
  });

  it("a wheel over the minimap is handed to the transcript, as the rail hands its own", () => {
    expect(minimapWheel).toContain(
      "export function forwardWheelToTimeline(event: WheelEvent, timeline: HTMLElement): void",
    );
  });

  it("the minimap's pieces stand left by these classes, which scrollRail.css mirrors", () => {
    expect(messagesTimeline).toContain('data-testid="timeline-minimap"');
    expect(messagesTimeline).toContain(
      '"group/minimap pointer-events-none absolute inset-y-0 left-0 z-40 hidden w-18',
    );
    expect(messagesTimeline).toContain('"absolute top-1/2 left-3 -translate-y-1/2"');
    expect(messagesTimeline).toContain('className="absolute top-0 left-3 h-full w-px');
    expect(messagesTimeline).toContain('"absolute left-1 z-10 inline-flex -translate-x-1/2');
    expect(messagesTimeline).toContain(
      '"group/strip pointer-events-none absolute left-0 h-0.5 w-6 origin-left',
    );
    expect(messagesTimeline).toContain("data-minimap-strip");
    expect(messagesTimeline).toContain('"pointer-events-auto absolute left-8 w-80');
    expect(messagesTimeline).toContain("data-minimap-preview");
  });

  it("no other piece of the minimap stands by a left-3 or left-1 the mirror would move", () => {
    const minimap = messagesTimeline.slice(
      messagesTimeline.indexOf("function TimelineMinimap("),
      messagesTimeline.indexOf("type TimelineWorkEntry"),
    );
    expect(minimap.match(/\bleft-3\b/g)).toHaveLength(2);
    expect(minimap.match(/\bleft-1\b/g)).toHaveLength(1);
  });
});
