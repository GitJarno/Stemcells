/**
 * Upstream behaviour the left column's rail relies on. A failure here after
 * a sync names the contract that moved; the rail is likely drawn at the
 * wrong width, or its seams are gone.
 */
import { describe, expect, it } from "vite-plus/test";

import appSidebarLayout from "../../components/AppSidebarLayout.tsx?raw";
import sidebarChrome from "../../components/sidebar/SidebarChrome.tsx?raw";
import sidebar from "../../components/ui/sidebar.tsx?raw";
import { effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";

describe("the rail's seams", () => {
  it("the app's sidebar renders its thread list from the module our substitute stands in the left column", () => {
    expect(appSidebarLayout).toContain('import ThreadSidebar from "./Sidebar";');
    expect(appSidebarLayout).toContain("<ThreadSidebar routeReveal={sidebarRouteReveal} />");
    expect(appSidebarLayout).toMatch(/<Sidebar\s[^>]*data-app-sidebar=""/);
  });

  it("the wide sidebar's foot carries the control back to the rail, after the disk", () => {
    expect(sidebarChrome).toMatch(/<DiskFoot \/>\s*<NarrowColumnButton \/>/);
  });
});

describe("upstream's sidebar, as rail.css reads it", () => {
  it("sizes its gap and container by --sidebar-width, inside the element rail.css sets it on", () => {
    expect(sidebar).toMatch(/data-slot="sidebar"\s+data-state=\{state\}/);
    expect(sidebar).toContain('"relative w-(--sidebar-width) bg-transparent"');
    expect(sidebar).toContain('"fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) md:flex"');
    expect(sidebar).toMatch(/data-slot="sidebar-gap"/);
  });

  it("hides offcanvas by the same width, so hiding the rail slides it out whole", () => {
    expect(sidebar).toContain(
      "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]",
    );
  });

  it("names its resize handle, which the rail has no use for", () => {
    expect(sidebar).toContain('data-slot="sidebar-rail"');
  });

  it("says on its wrapper whether it shows, and where the titlebar's content starts", () => {
    expect(sidebar).toContain("data-sidebar-state={state}");
    expect(sidebar).toContain('"--workspace-titlebar-content-left":');
  });

  it("is hidden and shown by its toggle shortcut and button, which stay upstream's", () => {
    expect(appSidebarLayout).toContain('"sidebar.toggle"');
    expect(appSidebarLayout).toMatch(/toggleSidebar\(\);/);
  });
});

describe("a snoozed chat", () => {
  it("is out of the rail until its wake time", () => {
    const shell = {
      snoozedUntil: "2026-10-21T12:00:00.000Z",
      hasPendingApprovals: false,
      hasPendingUserInput: false,
    } as Parameters<typeof effectiveSnoozed>[0];
    expect(effectiveSnoozed(shell, { now: "2026-10-21T11:00:00.000Z" })).toBe(true);
    expect(effectiveSnoozed(shell, { now: "2026-10-21T12:30:00.000Z" })).toBe(false);
  });
});
