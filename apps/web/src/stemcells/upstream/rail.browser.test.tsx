import "./appStyles";
import "../rail/rail.css";

import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { Sidebar, SidebarProvider } from "../../components/ui/sidebar";
import { render } from "./testRender";

/** What the Cells' column and the rail set on the root while they show (`Cells.tsx`, `Rail.tsx`). */
function showColumn(column: string) {
  document.documentElement.dataset.stemcellsColumn = column;
  return { [Symbol.dispose]: () => delete document.documentElement.dataset.stemcellsColumn };
}

// Dragging the edge back out sizes the column by the drag and keeps that width for the Cells'
// column; the rail has one width, so a hidden rail comes back by the sidebar button alone.
describe("a hidden left column", () => {
  it.each([
    ["cells", "block"],
    ["rail", "none"],
  ])("on the %s, upstream's edge to drag it back out is display: %s", async (column, display) => {
    await page.viewport(1280, 800);
    using _column = showColumn(column);
    await using screen = await render(
      <SidebarProvider defaultOpen={false}>
        <Sidebar
          collapsible="offcanvas"
          data-app-sidebar=""
          resizable={{ collapseOnResize: true, minWidth: 208, maxWidth: 480 }}
        />
      </SidebarProvider>,
      { router: false /* no routes involved */ },
    );
    const edge = screen.container.querySelector<HTMLElement>('[data-slot="sidebar-restore-edge"]');
    expect(edge).not.toBeNull();
    expect(getComputedStyle(edge!).display).toBe(display);
  });
});
