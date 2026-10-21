/**
 * Upstream behaviour the frame relies on: on Stemcells' own theme,
 * pages/frame.css takes the line off the sidebar's edge by giving
 * `[data-app-sidebar]`'s border no width; the sidebar, the inset the
 * workspace is and the frame behind them wear the same grain, so they read
 * as one ground; and the slate is flat because upstream's chat is. A
 * failure here after a sync names the contract that moved: a line or an
 * edge is likely back, or the slate no longer matches upstream's chat.
 */
import { describe, expect, it } from "vite-plus/test";

import appSidebarLayout from "../../components/AppSidebarLayout.tsx?raw";
import chatView from "../../components/ChatView.tsx?raw";
import sidebar from "../../components/ui/sidebar.tsx?raw";
import themePalette from "../../themePalette.ts?raw";

describe("the frame's contracts with upstream", () => {
  it("the app's sidebar carries the attribute frame.css names", () => {
    expect(appSidebarLayout).toMatch(/<Sidebar\s[^>]*data-app-sidebar=""/);
  });

  it("the sidebar's edge is a border on the element that carries it", () => {
    // The props, the attribute among them, land on the container that draws
    // the edge; a box-shadow or a pseudo-element would keep its line.
    expect(sidebar).toContain(
      "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r",
    );
    expect(sidebar).toMatch(/data-slot="sidebar-container"\s+\{\.\.\.props\}/);
  });

  it("the sidebar and the inset wear the same grain, under their own colours", () => {
    // workspace.css sets only the inset's colour, so its grain stays, and
    // frame.css paints the frame behind with the same token; were one to
    // lose it, the rail would stand apart from the frame beside it, as an
    // edge.
    expect(sidebar).toMatch(
      /className="flex h-full w-full flex-col bg-sidebar surface-grain[^"]*"\s+data-sidebar="sidebar"\s+data-slot="sidebar-inner"/,
    );
    expect(sidebar).toContain(
      '"relative flex min-w-0 w-full flex-1 flex-col bg-background surface-grain"',
    );
  });

  it("upstream's chat is flat: its ground covers the inset's grain", () => {
    expect(chatView).toContain(
      'className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background"',
    );
  });

  it("the root names the theme in use, as the frame's selector reads it", () => {
    expect(themePalette).toContain("root.dataset.themeId = palette.id;");
  });
});
