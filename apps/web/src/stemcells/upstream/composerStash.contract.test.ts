// @effect-diagnostics nodeBuiltinImport:off - reads the stylesheet on disk.
/**
 * What the stash on the Cell's ledge (`composer/LineStash.tsx`, through the
 * `ComposerStashBadge` substitute) relies on in upstream: that
 * `ComposerStashMenu` knows its trigger by `data-prompt-stash-badge`, so a
 * click on the ledge's stash toggles the menu instead of closing it on the
 * press and opening it again on the click; and that `ChatComposer` anchors
 * the menu on the composer's body, not on the trigger, so the menu opens
 * where upstream's does wherever the trigger stands, inset from the box's
 * sides by the shell's drawer inset, which the ledge stands in by too. A
 * failure here after a sync names the contract that moved; the stash on the
 * ledge likely can't close its menu, or the menu opens off the box or off
 * the ledge's edges.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import chatComposer from "../../components/chat/ChatComposer.tsx?raw";
import commandMenuLayer from "../../components/chat/ComposerCommandMenuLayer.tsx?raw";
import composerSurface from "../../components/chat/ComposerSurface.tsx?raw";
import stashMenu from "../../components/chat/ComposerStashMenu.tsx?raw";

/** CSS imports come in empty under test; the stylesheet is read as text. */
const composerLineCss = NodeFS.readFileSync(
  new URL("../composer/composer-line.css", import.meta.url),
  "utf8",
);

describe("the ledge's stash's contracts with upstream", () => {
  it("ComposerStashMenu knows its trigger by data-prompt-stash-badge", () => {
    expect(stashMenu.match(/closest\('\[data-prompt-stash-badge="true"\]'\)/g)).toHaveLength(2);
  });

  it("ChatComposer anchors the stash menu on the composer's body", () => {
    expect(chatComposer).toMatch(
      /ref=\{setComposerMenuAnchor\}\s*data-chat-composer-body="true"[\s\S]{0,600}?<ComposerCommandMenuLayer anchor=\{composerMenuAnchor\}>\s*<ComposerStashMenu\b/,
    );
  });

  it("the menu stands in by the shell's drawer inset, as the ledge does", () => {
    expect(commandMenuLayer).toContain('.getPropertyValue("--chat-composer-drawer-inset")');
    const inset = /\[--chat-composer-drawer-inset:([\d.]+rem)\]/.exec(composerSurface)?.[1];
    expect(composerLineCss).toContain(`--ledge-inset: ${inset};`);
  });
});
