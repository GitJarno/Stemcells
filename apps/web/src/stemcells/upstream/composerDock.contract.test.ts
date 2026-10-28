// @effect-diagnostics nodeBuiltinImport:off - reads the stylesheet on disk.
/**
 * What the dock's CSS (`tabs/workspace.css`) relies on in upstream's composer: an approval drops
 * the controls row, whose height the box keeps; T3's banners attach above the box inside the
 * form as insets with their own outline colour, over a box with its own rounded outline. A
 * failure after a sync: the box shrinks under an approval, or a banner and box read as two.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import chatComposer from "../../components/chat/ChatComposer.tsx?raw";
import composerBanner from "../../components/chat/ComposerBanner.tsx?raw";
import composerSurface from "../../components/chat/ComposerSurface.tsx?raw";

/** CSS imports come in empty under test; the stylesheet is read as text. */
const workspaceCss = NodeFS.readFileSync(new URL("../tabs/workspace.css", import.meta.url), "utf8");

describe("the composer's dock and upstream", () => {
  it("an approval keeps the controls row, so the box keeps its height with no help", () => {
    // Only a collapsed phone composer drops the row; workspace.css no longer
    // pads the field for a missing row while an approval waits.
    expect(chatComposer).toMatch(
      /\{isComposerCollapsedMobile \? null : \(\s*<div\s*data-chat-composer-footer="true"/,
    );
    expect(chatComposer).toMatch(/data-chat-composer-surface="true"/);
    expect(chatComposer).toMatch(/data-chat-composer-body="true"/);
    expect(workspaceCss).not.toContain('not(:has(> [data-chat-composer-footer="true"]))');
  });

  it("banners attach above the box inside the form, inset, in their own outline", () => {
    // The dock is the form's first child: an attachment inset by the drawer.
    expect(chatComposer).toMatch(
      /data-chat-composer-form="true"[\s\S]{0,1200}?<ComposerBanner\.Dock>/,
    );
    expect(composerBanner).toContain('data-slot="composer-banner-attachment"');
    expect(composerBanner).toContain("w-[calc(100%-2*var(--chat-composer-drawer-inset))]");
    expect(composerBanner).toContain(
      "[data-chat-composer-form]>[data-slot=composer-banner-attachment]",
    );
    // A banner's outline is one variable, its tone another.
    expect(composerBanner).toContain('data-composer-banner-surface="attached"');
    expect(composerBanner).toContain(
      "before:border before:border-(--chat-composer-attached-outline)",
    );
    expect(composerBanner).toContain("--chat-composer-attached-tint:");
    // A tab as wide as its words says so, and leaves the box whole.
    expect(composerBanner).toContain("data-composer-banner-width={width}");
    expect(composerBanner).toContain('width === "content" ? "w-fit max-w-full flex-none"');
  });

  it("the box draws its outline round its own corners, from the outline colour", () => {
    expect(composerSurface).toContain('data-chat-composer-main-surface="true"');
    expect(composerSurface).toContain(
      "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-(--chat-composer-outline)",
    );
    expect(composerSurface).toMatch(/"group relative z-10 rounded-2xl p-px"/);
    expect(chatComposer).toMatch(/data-chat-composer-surface="true"[\s\S]{0,200}?"rounded-2xl /);
    // The glass takes the box's own corners: no strip cuts it.
    expect(composerSurface).toContain("before:inset-0 before:z-0 before:rounded-2xl ");
  });
});
