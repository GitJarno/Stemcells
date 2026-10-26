import { describe, expect, it, vi } from "vite-plus/test";

import {
  getPreviewPanelMaxWidth,
  usePreviewPanelInlineSize as useUpstreamInlineSize,
} from "../../../hooks/usePreviewPanelInlineSize";
import { usePreviewPanelInlineSize } from "./usePreviewPanelInlineSize";

import panelShell from "../../../components/preview/PreviewPanelShell.tsx?raw";
import inlineSize from "../../../hooks/usePreviewPanelInlineSize.ts?raw";
import resizableWidth from "../../../hooks/useResizableWidth.ts?raw";

vi.mock("../../../hooks/usePreviewPanelInlineSize", async (original) => ({
  ...(await original<typeof import("../../../hooks/usePreviewPanelInlineSize")>()),
  usePreviewPanelInlineSize: vi.fn(),
}));

const WINDOW = 1560;
const PAGE = 1496;
const MIN = 360;

/**
 * Frames of layout: the panel takes the width the person gave it, clamped
 * to a cap measured on a container, and the container answers for the next.
 */
function frames(given: number, container: (panel: number) => number): number[] {
  const widths: number[] = [];
  let panel = given;
  for (let frame = 0; frame < 8; frame++) {
    const cap = getPreviewPanelMaxWidth(WINDOW, container(panel));
    panel = Math.max(MIN, Math.min(cap, given));
    widths.push(panel);
  }
  return widths;
}

describe("the Surface's width comes from the person, never from itself", () => {
  it("capped against the chat beside it, a width past the middle never settles", () => {
    // The launch jank: a stored 800 shook between two widths, forever.
    const beside = frames(800, (panel) => PAGE - panel);
    expect(new Set(beside.slice(2)).size).toBe(2);
  });

  it("capped against the tab's page, it holds the width it was given", () => {
    expect(new Set(frames(800, () => PAGE))).toEqual(new Set([800]));
    expect(new Set(frames(5000, () => PAGE)).size).toBe(1);
  });

  it("a chat in a pane hands upstream its tab's page to measure", () => {
    const page = { page: true };
    const chat = {
      closest: (selector: string) => (selector === "[data-stemcells-page]" ? page : null),
    };
    usePreviewPanelInlineSize({ container: chat as never, widthStorageKey: "w" });
    expect(vi.mocked(useUpstreamInlineSize)).toHaveBeenLastCalledWith({
      container: page,
      widthStorageKey: "w",
    });
    // Upstream caps against the container it is handed, ahead of the panel's own row.
    expect(inlineSize).toContain(
      "const row = container ?? (enabled ? host.parentElement : null) ?? null;",
    );
  });

  it("outside a pane, upstream measures what it always did", () => {
    const chat = { closest: () => null };
    usePreviewPanelInlineSize({ container: chat as never });
    expect(vi.mocked(useUpstreamInlineSize)).toHaveBeenLastCalledWith({
      container: chat,
    });
  });

  it("nothing in the Surface widens it: upstream sizes it from its width alone", () => {
    // The panel's width is the person's (stored, or the drag's), and its
    // content can't push it: a set width that doesn't grow or shrink to fit.
    expect(panelShell).toContain("min-w-0 max-w-full");
    expect(panelShell).toContain('"shrink-0 border-l border-border"');
    expect(panelShell).toMatch(/: `var\(\$\{RESIZABLE_WIDTH_PROPERTY\}\)`/);
    // ...and only the person's drag, or the stored width, writes it.
    expect(resizableWidth.match(/setWidthState\(\{[^}]*\}\)/g)).toEqual([
      "setWidthState({ storageKey, width: readWidth() })",
      "setWidthState({ storageKey: startStorageKey, width: finalWidth })",
    ]);
    expect(resizableWidth).toMatch(
      /finish\(finalWidth\) \{\s*setWidthState\([^)]*\);\s*try \{\s*setLocalStorageItem\(startStorageKey, finalWidth, WidthSchema\);/,
    );
  });
});
