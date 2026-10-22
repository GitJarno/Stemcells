/**
 * What a chat in a narrow pane relies on in upstream. A failure here after a
 * sync names the contract that moved: a chat may lose its end when its pane
 * narrows, the Scroll-to-end pill may sit on the Cell and its line, the
 * placeholder may run down over the controls, or a wide table may stop
 * saying it scrolls sideways.
 */
import { describe, expect, it } from "vite-plus/test";

import chatComposer from "../../components/chat/ChatComposer.tsx?raw";
import chatView from "../../components/ChatView.tsx?raw";
import composerFooterLayout from "../../components/composerFooterLayout.ts?raw";
import promptEditor from "../../components/ComposerPromptEditorTiptap.tsx?raw";
import markdownTable from "../../components/chat/MarkdownTable.tsx?raw";
import messagesTimeline from "../../components/chat/MessagesTimeline.tsx?raw";
import scrollArea from "../../components/ui/scroll-area.tsx?raw";
import timelineOverlays from "../../components/chat/TimelineOverlays.tsx?raw";

describe("a chat in a narrow pane, against upstream", () => {
  it("the transcript holds its end only through growth within a screen, so the pane holds it across a width change", () => {
    expect(messagesTimeline).toContain("maintainScrollAtEndThreshold={1}");
    expect(messagesTimeline).toContain('"messages-timeline-scroll scrollbar-gutter-both');
  });

  it("the Scroll-to-end pill clears the whole composer overlay, the Cell and its line included", () => {
    expect(chatView).toMatch(/<ScrollToEndButton\s+bottom=\{scrollToEndClearance \+ 4\}/);
    expect(timelineOverlays).toContain("style={{ bottom: props.bottom }}");
    expect(chatView).toContain("overlayHeight: nextHeight,");
    expect(composerFooterLayout).toContain(
      "return Math.ceil(input.overlayHeight - (top - contentTop));",
    );
  });

  it("the placeholder is one element the composer can keep to its one row", () => {
    expect(promptEditor).toMatch(
      /\{isEmpty && contextRecords\.size === 0 && placeholder \? \(\s*<div\s*className=\{cn\(\s*"pointer-events-none absolute inset-0 leading-relaxed text-placeholder\/75",/,
    );
    expect(chatComposer).toContain('data-chat-composer-body="true"');
  });

  it("a table scrolls sideways in an area with an edge fade sized by --fade-size", () => {
    expect(markdownTable).toMatch(
      /className="chat-markdown-table-container"[\s\S]*?<ScrollArea radius="none" chainVerticalScroll scrollFade/,
    );
    expect(scrollArea).toContain(
      "mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))]",
    );
    expect(scrollArea).toContain('data-slot="scroll-area-viewport"');
  });
});
