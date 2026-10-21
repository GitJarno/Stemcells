/**
 * What the line over a Cell's composer, the composer's halo and its one
 * height rely on in upstream: that the line stands right before the
 * composer's plate, inside the overlay whose height the transcript keeps
 * clear at its foot; that the plate stacks its own layers, so the halo lies
 * under its glass; that the composer rests into one line only through its
 * scroll gesture, which a substitute turns off; that its field's height is
 * one class `workspace.css` can lower; and that a wheel over the composer
 * reaches it. A failure here after a sync names the contract that moved; the
 * line likely covers the transcript's last row or sits in a box of its own,
 * the halo covers the plate, the composer shrinks on a scroll or opens tall,
 * or a wheel over it stops at the plate.
 */
import { describe, expect, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";
import chatComposer from "../../components/chat/ChatComposer.tsx?raw";
import composerSurface from "../../components/chat/ComposerSurface.tsx?raw";
import promptEditor from "../../components/ComposerPromptEditorTiptap.tsx?raw";

describe("the composer line's contracts with upstream", () => {
  it("stands right before the composer's plate, outside its glass", () => {
    expect(chatView).toMatch(/<CellComposerLine \/>\s*<ComposerSurface\.Shell\b/);
    // Not one of upstream's attached banners: an attached banner gives the
    // plate a second surface, and the three read as overlapping layers.
    expect(chatComposer).not.toContain("<CellComposerLine");
  });

  it("the transcript keeps the height of the overlay the line is in clear at its foot", () => {
    // ChatView measures the overlay holding the composer, line and all, and
    // reserves that height under the transcript's last row.
    expect(chatView).toMatch(
      /ref=\{setComposerOverlayElement\}[\s\S]*?data-chat-composer-overlay="true"[\s\S]*?<CellComposerLine \/>/,
    );
    expect(chatView).toContain(
      "publishComposerOverlayHeightStable(composerOverlayElement.getBoundingClientRect().height);",
    );
    expect(chatView).toMatch(/const nextInset = resolveComposerTimelineInset\(\{/);
  });

  it("the plate stacks its own layers, so the halo lies under its glass", () => {
    // glow.css draws the halo as the plate's ::after at z-index -1: under the
    // glass (its ::before, at 0) only while the plate is a stacking context,
    // and the ::after is free only while upstream draws nothing there.
    const shell = composerSurface.slice(
      composerSurface.indexOf("function Shell("),
      composerSurface.indexOf("const outlineClasses"),
    );
    expect(shell).toContain('data-slot="composer-shell"');
    expect(shell).toContain("group/composer-surface relative isolate ");
    expect(shell).toContain("before:z-0");
    expect(shell).not.toMatch(/\bafter:/);
  });

  it("the composer rests into one line only when its scroll gesture says so", () => {
    // substitutes/composerScrollGesture.ts answers both gestures with "no";
    // a third way to rest would bring the shrinking back.
    expect(chatComposer.match(/setIsComposerScrollCollapsed\(true\)/g)).toHaveLength(2);
    expect(chatComposer).toMatch(
      /const shouldCollapse = recordComposerScrollGestureEvent\([\s\S]{0,500}?if \(!shouldCollapse\) \{\s*return;\s*\}\s*setIsComposerScrollCollapsed\(true\);/,
    );
    expect(chatComposer).toMatch(
      /shouldCollapseComposerForScrollKey\(\{[\s\S]{0,300}?\}\)\s*\)\s*\{\s*setIsComposerScrollCollapsed\(true\);/,
    );
  });

  it("the field's height is one class, and it grows to a cap as text is typed", () => {
    // workspace.css lowers the field to one row; upstream's cap and scroll
    // still let it grow with what is typed.
    expect(promptEditor).toContain(
      '"composer-tiptap -m-1 block max-h-52 min-h-19.5 overflow-y-auto p-1 ',
    );
  });

  it("a wheel over the composer lands on its stack, over the transcript", () => {
    // The overlay lets the pointer through to the transcript; its stack takes
    // it back, and `scrollThrough` passes a vertical wheel on.
    expect(chatView).toMatch(
      /data-chat-composer-overlay="true"[\s\S]{0,300}?"pointer-events-none absolute inset-x-0 bottom-0/,
    );
    expect(chatView).toMatch(
      /data-chat-composer-stack="true"\s+className="[^"]*\bpointer-events-auto\b/,
    );
  });
});
