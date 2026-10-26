/**
 * What the terminal drawer's opening height and buttons' row rely on in upstream
 * (`substitutes/ThreadTerminalDrawer.tsx`, `terminal.ts`, `stemcells/terminal`). A failure after
 * a sync names the contract that moved; the drawer likely opens at 280px or a row off, its
 * buttons over the text, without moving, or with the words over it a frame behind its edge.
 */
import { resolveChatListAnchoredEndSpace } from "@t3tools/shared/chatList";
import { describe, expect, it } from "vite-plus/test";

import chatTerminalDrawers from "../../components/chat/ChatTerminalDrawers.tsx?raw";
import appFrame from "../../components/chat/McpAppFrame.tsx?raw";
import timeline from "../../components/chat/MessagesTimeline.tsx?raw";
import findBar from "../../components/chat/ThreadFindBar.tsx?raw";
import persistentTerminals from "../../components/PersistentThreadTerminals.tsx?raw";
import { PanelAnimationSuppressionProvider } from "../../panelAnimations";
import drawer from "../../components/ThreadTerminalDrawer.tsx?raw";
import surface from "../../terminal/ghostty/surface.ts?raw";
import terminalStore from "../../terminalUiStateStore.ts?raw";

describe("the terminal drawer's contracts with upstream", () => {
  it("a chat's drawer gets the height stored for the chat, upstream's own until a drag", () => {
    expect(persistentTerminals).toContain(
      'import ThreadTerminalDrawer from "./ThreadTerminalDrawer";',
    );
    expect(persistentTerminals).toContain("height={terminalUiState.terminalHeight}");
    expect(persistentTerminals).toContain("onHeightChange={setTerminalHeight}");
    expect(terminalStore).toMatch(
      /const DEFAULT_THREAD_TERMINAL_UI_STATE[^=]*= Object\.freeze\(\{\s*terminalOpen: false,\s*terminalHeight: DEFAULT_THREAD_TERMINAL_HEIGHT,/,
    );
  });

  it("the drawer draws at the height it is given, and a drag stores its height once, at its end", () => {
    expect(drawer).toContain("const drawerHeight = clampDrawerHeight(height, maxDrawerHeight);");
    expect(drawer).toContain(
      "style={isPanel ? undefined : { height: `var(${DRAG_HEIGHT_PROPERTY}, ${drawerHeight}px)` }}",
    );
    expect(drawer).toMatch(
      /if \(resizeState\.height === resizeState\.startHeight \|\| resizeState\.height === height\) return;\s*onHeightChange\(resizeState\.height\);/,
    );
  });

  it("the drawer's rows fill it below a 1px top edge, inside the terminal's 4px padding", () => {
    expect(drawer).toContain(
      'isPanel ? "h-full flex-1" : "z-45 shrink-0 border-t border-border/80"',
    );
    expect(surface).toContain("const CONTENT_PADDING = 4;");
    expect(surface).toContain(
      "const grid = terminalGridSize(mount.clientWidth, mount.clientHeight, metrics, CONTENT_PADDING);",
    );
  });

  it("the buttons float in a box of their own at the drawer's top-right, each labelled", () => {
    // terminal.css finds the box as the drawer's child holding labelled buttons.
    expect(drawer).toMatch(
      /<aside\s+ref=\{drawerRef\}\s+data-thread-terminal-drawer[\s\S]*?<div className="pointer-events-none absolute right-2 top-2 z-20">\s*<div className="pointer-events-auto inline-flex items-center [^"]*">\s*<TerminalActionButton/,
    );
    expect(drawer).toMatch(/render=\{\s*<button[^>]*aria-label=\{label\}/);
  });

  it("the drawer sits in a one-row grid that opens and closes it, one div above ours", () => {
    // terminal.css moves that row; it finds the grid as our host's grandparent.
    expect(persistentTerminals).toMatch(
      /"grid shrink-0 overflow-clip",\s*active \? \(visible \? "grid-rows-\[1fr\]" : "grid-rows-\[0fr\]"\) : "hidden",/,
    );
    expect(persistentTerminals).toMatch(
      /<div className="min-h-0 overflow-clip">\s*<ThreadTerminalDrawer/,
    );
  });

  it("the drawer stays mounted through its close for as long as the motion the seam gives", () => {
    expect(chatTerminalDrawers).toMatch(
      /usePanelPresence\(\s*Boolean\(activeThreadKey && props\.activeTerminalOpen\),\s*true,\s*panelAnimationsActive,\s*activeThreadKey,\s*panelAnimationDurationMs,\s*\)/,
    );
  });

  it("a route's first paint holds panels still through a context the drawer's motion reads", () => {
    // useDrawerMotion reads the context through its provider: in React 19 they are one.
    expect(Reflect.get(PanelAnimationSuppressionProvider, "Provider")).toBe(
      PanelAnimationSuppressionProvider,
    );
  });

  it("the list keeps its end within a screen of it, only while it follows the end", () => {
    // keepEnd does as much in the same frame, where our timeline marks the
    // list as following (live follow on, no anchor) and nothing holds its place.
    expect(timeline).toContain("maintainScrollAtEndThreshold={1}");
    expect(timeline).toMatch(
      /maintainScrollAtEnd=\{[^}]*anchoredEndSpace \|\|\s*!liveFollowEnabled \|\|\s*fullscreenAppRowId !== null \|\|/,
    );
    expect(timeline).toContain("liveFollowEnabled={!findOpen && props.liveFollowEnabled}");
    expect(resolveChatListAnchoredEndSpace([{ id: "m" }], null, (row) => row.id)).toBeUndefined();
    expect(findBar).toMatch(/^\s+data-thread-find-bar$/m);
    expect(appFrame).toContain('data-mcp-app-fullscreen={fullscreen ? "" : undefined}');
  });

  it("the terminal store reads what it kept from localStorage as it is made, so a load opens nothing", () => {
    // terminalJustOpened counts an opening only from a change it sees after that.
    expect(terminalStore).toContain("storage: createJSONStorage(createTerminalUiStateStorage),");
    expect(terminalStore).toContain(
      'return resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined);',
    );
  });
});
