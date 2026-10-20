/**
 * Upstream behaviour the frame relies on: on Stemcells' own theme,
 * workspace.css takes the line off the sidebar's edge by making
 * `[data-app-sidebar]`'s border transparent. A failure here after a sync
 * names the contract that moved, and the line is likely back.
 */
import { describe, expect, it } from "vite-plus/test";

import appSidebarLayout from "../../components/AppSidebarLayout.tsx?raw";
import sidebar from "../../components/ui/sidebar.tsx?raw";
import themePalette from "../../themePalette.ts?raw";

describe("the frame's contracts with upstream", () => {
  it("the app's sidebar carries the attribute workspace.css names", () => {
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

  it("the root names the theme in use, as the frame's selector reads it", () => {
    expect(themePalette).toContain("root.dataset.themeId = palette.id;");
  });
});
