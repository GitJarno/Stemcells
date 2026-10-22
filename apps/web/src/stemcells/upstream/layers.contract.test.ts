/**
 * The open-layer rule a thrown Cell's Esc defers to (`layers.ts`) is
 * upstream's own. A failure here after a sync names what moved: a layer
 * upstream now counts (or no longer does), or how it tells open from
 * closed-but-mounted.
 */
import { describe, expect, it } from "vite-plus/test";

import rightPanelTabs from "../../components/RightPanelTabs.tsx?raw";
import { LAYER_SLOTS } from "./layers";

/** Upstream's list of the layers that block its shortcuts, as written. */
function upstreamSlots(): string[] {
  const list = /const LAUNCHER_SHORTCUT_BLOCKING_LAYERS = \[([^\]]*)\]/.exec(rightPanelTabs)?.[1];
  return [...(list ?? "").matchAll(/"([^"]+)"/g)].map((match) => match[1]!);
}

describe("the open layers' contract with upstream", () => {
  it("counts the same layers upstream's shortcuts give way to", () => {
    expect(upstreamSlots()).toEqual([...LAYER_SLOTS]);
  });

  it("tells an open layer, or one still leaving, from a closed one kept mounted", () => {
    expect(rightPanelTabs).toContain(
      '.map((slot) => `[data-slot="${slot}"]:is([data-open],[data-ending-style])`)',
    );
  });
});
