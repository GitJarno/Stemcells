// @effect-diagnostics nodeBuiltinImport:off - reads the stylesheet on disk.
/**
 * The tab on stage reaches down to the slate by the strip's air under it,
 * which workspace.css works out from TabStrip's row and chip heights. If
 * either height moves alone, the tab floats above the slate or cuts into it.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import tabStrip from "./TabStrip.tsx?raw";

/** CSS imports come in empty under test; the stylesheet is read as text. */
const workspaceCss = NodeFS.readFileSync(new URL("./workspace.css", import.meta.url), "utf8");

describe("the tab on stage meets the slate", () => {
  it("reaches down by half the strip's row less the tab, at the heights TabStrip draws", () => {
    expect(tabStrip).toMatch(/className="flex h-9 [^"]*" data-stemcells-tab-strip=""/);
    // Both kinds of tab: the Cells' and Aski's.
    expect(tabStrip).toContain('"group/tab flex h-6 ');
    expect(tabStrip).toContain('"flex h-6 shrink-0 cursor-pointer');
    expect(workspaceCss).toContain("--stemcells-tab-reach: calc(var(--spacing) * (9 - 6) / 2);");
  });

  it("is a chip again while a drag lifts it", () => {
    expect(tabStrip).toContain("data-dragged={dragged || undefined}");
    expect(workspaceCss).toContain(
      '[data-stemcells-tab][aria-selected="true"]:not([data-dragged])',
    );
  });
});
