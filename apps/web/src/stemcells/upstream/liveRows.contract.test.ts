// @effect-diagnostics nodeBuiltinImport:off - reads upstream's stylesheet on disk.
/**
 * What the pane's one wave relies on in upstream's live rows (`glow/liveRows.ts`): each box it
 * lights goes to `observeVisibleAnimation` (our substitute joins it to the wave), lit as an
 * overlay or a shining label in the shapes the wave measures. A failure after a sync: the shine
 * is likely misplaced, off the crest, or back on upstream's own clock.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import messagesTimeline from "../../components/chat/MessagesTimeline.tsx?raw";
import rowParts from "../../components/chat/TimelineRowParts.tsx?raw";
import workGroupRows from "../../components/chat/TimelineWorkGroupRows.tsx?raw";

/** CSS imports come in empty under test; the stylesheet is read as text. */
const indexCss = NodeFS.readFileSync(new URL("../../index.css", import.meta.url), "utf8");

/** The body of the CSS rule or at-rule that starts with `head`. */
function block(source: string, head: string): string {
  const start = source.indexOf(head);
  expect(start, head).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unclosed: ${head}`);
}

describe("upstream's live rows, as the wave reads them", () => {
  it("hands every box it lights to observeVisibleAnimation, from the module we substitute", () => {
    // The transcript's rows live in these modules; each that lights a box
    // takes observeVisibleAnimation from the module we substitute.
    for (const source of [messagesTimeline, workGroupRows]) {
      expect(source).toContain(
        'import { observeVisibleAnimation } from "../../lib/visibleAnimation";',
      );
    }
    const timeline = [messagesTimeline, workGroupRows].join("\n");
    // The live rows' boxes, the working label's, a separator's and a work group's header.
    const refs = timeline.match(/ref=\{[^}]*\? observeVisibleAnimation : undefined\}/g) ?? [];
    expect(refs.length).toBeGreaterThanOrEqual(4);
  });

  it("an overlay is the box's own child: a copy of the row sliding the other way inside it", () => {
    const overlay = rowParts.slice(rowParts.indexOf("function ActivityShimmerOverlay"));
    expect(overlay).toMatch(
      /className="live-activity-focus [^"]*absolute[^"]*"[^]*?<span className="live-activity-focus-counter block">\s*<span className="live-activity-focus-aligned block text-foreground">\{children\}<\/span>/,
    );
    expect(workGroupRows).toContain(
      "{shimmer ? <ActivityShimmerOverlay>{label}</ActivityShimmerOverlay> : null}",
    );
  });

  it("an overlay runs one band past each side of its row, its band's crest at half a band in", () => {
    const focus = block(indexCss, "@utility live-activity-focus {");
    expect(focus).toContain("--live-activity-focus-width: 4.5rem;");
    expect(focus).toContain("left: calc(-1 * var(--live-activity-focus-width));");
    expect(focus).toContain(
      "width: calc(100% + var(--live-activity-focus-width) + var(--live-activity-focus-width));",
    );
    // The mask peaks at 2.25rem, half the 4.5rem band, and is clear past it.
    expect(focus).toMatch(
      /mask-image: linear-gradient\(\s*to right,\s*transparent 0,[^;]*black 2\.25rem,[^;]*transparent var\(--live-activity-focus-width\)/,
    );
    expect(focus).toMatch(
      /@media \(prefers-reduced-motion: reduce\), \(forced-colors: active\) \{\s*animation: none;\s*opacity: 0;/,
    );
  });

  it("a shining label is a band over the label's ink, clipped to its words, moved by its background's place", () => {
    const shine = block(indexCss, "@utility live-tool-shine {");
    expect(shine).toContain(
      "@media (prefers-reduced-motion: no-preference) and (forced-colors: none)",
    );
    expect(shine).toMatch(
      /background-image:\s*linear-gradient\(to right, transparent, [^)]+\), transparent\),\s*linear-gradient\(/,
    );
    expect(shine).toMatch(/background-size:\s*4\.5rem 100%,\s*100% 100%;/);
    expect(shine).toContain("background-clip: text;");
    const frames = block(indexCss, "@keyframes live-tool-shine {");
    expect(frames).toMatch(/background-position:\s*-4\.5rem 0,\s*0 0;/);
  });
});
