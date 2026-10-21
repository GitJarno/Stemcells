/**
 * What a pane relies on in upstream's thread details card (threadDetails.ts,
 * workspace.css). The card opens by default, which a Cell undoes on first
 * showing; it floats at the chat's top-right, where workspace.css moves it,
 * and the find bar above it, below the pane's buttons. A failure here after
 * a sync names the contract that moved; a new Cell likely shows the card
 * again, or the card sits under the pane's buttons.
 */
import { describe, expect, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";
import chatCanvas from "../../components/chat/ChatCanvas.tsx?raw";
import threadDetailsCard from "../../components/chat/ThreadDetailsCard.tsx?raw";
import threadDetailsCardLayout from "../../components/chat/threadDetailsCardLayout.ts?raw";
import threadFindBar from "../../components/chat/ThreadFindBar.tsx?raw";
import popover from "../../components/ui/popover.tsx?raw";
import rightPanelStore from "../../rightPanelStore.ts?raw";

describe("the thread details card's contracts with upstream", () => {
  it("opens beside every chat until it is told otherwise, and keeps a closed one", () => {
    expect(rightPanelStore).toMatch(
      /const DEFAULT_THREAD_PANEL_VISIBILITY: ThreadPanelVisibility = \{\s*inlineOpen: true,/,
    );
    expect(rightPanelStore).toMatch(
      /setThreadPanelOpen: \(\s*ref: ScopedThreadRef,\s*presentation: ThreadPanelPresentation,\s*open: boolean,\s*\) => void;/,
    );
    expect(rightPanelStore).toContain(
      "visibility.inlineOpen ? [] : [[threadKey, { inlineOpen: false, popoverOpen: false }]]",
    );
  });

  it("sets the inline card's place on the element, inside the chat's canvas", () => {
    expect(threadDetailsCard).toContain("const canvas = useChatCanvas();");
    expect(threadDetailsCard).toMatch(
      /"absolute z-20",[\s\S]{0,300}style=\{\{\s*right: placement\.right,\s*top: placement\.y,\s*width: placement\.width,\s*maxHeight: height,\s*\}\}\s*data-density=\{density\}\s*data-thread-details-panel="inline"/,
    );
    // The card in it can shrink in a column: it clips and scrolls its rows.
    expect(threadDetailsCard).toMatch(
      /"dropdown-glass isolate contain-paint grid max-h-full grid-rows-\[minmax\(0,1fr\)\] overflow-hidden rounded-3xl"[\s\S]{0,300}data-thread-details-card/,
    );
    expect(chatCanvas).toContain("data-chat-canvas");
  });

  it("puts the card below the find bar, measured, while the bar is open", () => {
    expect(threadFindBar).toMatch(/data-thread-find-bar\s*className="absolute top-3 right-3 z-40 /);
    expect(chatCanvas).toContain('element.querySelector<HTMLElement>("[data-thread-find-bar]")');
    expect(chatCanvas).toContain(
      "findBarBottom: findBarBounds ? findBarBounds.bottom - canvasBounds.top : 0,",
    );
    expect(threadDetailsCardLayout).toContain("const y = gap + topInset;");
  });

  it("hangs the popover card from the header's foot, 12px in from its right", () => {
    expect(chatView).toMatch(/<header\s+ref=\{threadPanelPopoverAnchorRef\}\s+data-chat-header/);
    expect(chatView).toContain("anchor={threadPanelPopoverAnchorRef}");
    expect(threadDetailsCard).toMatch(
      /anchor=\{anchor\}\s*align="end"[\s\S]{0,200}alignOffset=\{THREAD_DETAILS_CARD_GAP - 8\}[\s\S]{0,200}side="bottom"\s*sideOffset=\{topInset\}\s*variant="panel"/,
    );
    expect(threadDetailsCardLayout).toContain("export const THREAD_DETAILS_CARD_GAP = 12;");
    // The panel pads its card by 8px.
    expect(popover).toContain('"overflow-visible py-2 [--viewport-inline-padding:--spacing(2)]"');
  });

  it("floats the header's toggles from the chat's root once the header is static", () => {
    expect(chatView).toMatch(
      /ref=\{setWorkspaceLayoutElement\}\s*className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background"/,
    );
  });
});
