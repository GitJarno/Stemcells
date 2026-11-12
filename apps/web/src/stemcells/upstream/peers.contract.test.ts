// @effect-diagnostics nodeBuiltinImport:off - reads our stylesheet on disk.
/**
 * A Cell's note (`peers/PeerCard.tsx`) folds a long message by upstream's rule for the person's
 * own: `useTallEnoughToFold` folds what stands at least twice the fold's height. A failure here
 * after a sync names the rule that moved; a short note could fold behind "Show full message", or
 * a long one stand whole.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import tallEnoughToFold from "../../components/chat/useTallEnoughToFold.ts?raw";
import userMessageRow from "../../components/chat/TimelineUserMessageRow.tsx?raw";

/** CSS imports come in empty under test; the stylesheet is read as text. */
const peersCss = NodeFS.readFileSync(new URL("../peers/peers.css", import.meta.url), "utf8");

describe("a Cell's note folds as upstream folds the person's message", () => {
  it("folds what stands at least twice the fold's height, as tall as our fold clips", () => {
    // The person's message folds by the hook, measured on its unclipped body.
    expect(userMessageRow).toMatch(
      /const \{ ref: contentRef, tallEnough: canCollapse \} = useTallEnoughToFold\(/,
    );
    expect(userMessageRow).toMatch(/<div ref=\{contentRef\}>\s*<UserMessageBody/);
    expect(tallEnoughToFold).toContain(
      "setTallEnough(content.offsetHeight >= FOLDED_HEIGHT_REM * 2 * remPx);",
    );
    // The hook measures against the height our note's fold clips to.
    const folded = tallEnoughToFold.match(/const FOLDED_HEIGHT_REM = (\d+);/)?.[1];
    expect(folded).toBeDefined();
    expect(peersCss).toMatch(
      new RegExp(`\\.sc-peer-body\\[data-folded\\] \\{\\s*max-height: ${folded}rem;`),
    );
  });
});
