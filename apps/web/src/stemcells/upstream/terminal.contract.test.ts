/**
 * What the terminal drawer's opening height and its buttons' row rely on in
 * upstream (`substitutes/ThreadTerminalDrawer.tsx`, `terminal.ts`,
 * `stemcells/terminal`). A failure here after a sync names the contract that
 * moved; the drawer likely opens at upstream's 280px again, at a height off
 * by a row, or with its buttons back over the terminal's text.
 */
import { describe, expect, it } from "vite-plus/test";

import persistentTerminals from "../../components/PersistentThreadTerminals.tsx?raw";
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

  it("the drawer reads its height when it mounts and keeps it until a drag", () => {
    expect(drawer).toMatch(
      /useState\(\(\) => \(\{\s*threadId,\s*height: controlledDrawerHeight,\s*\}\)\)/,
    );
    expect(drawer).toMatch(
      /const preferredDrawerHeight =\s*drawerHeightState\.threadId === threadId \? drawerHeightState\.height : controlledDrawerHeight;/,
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
});
