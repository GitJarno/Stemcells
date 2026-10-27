/**
 * A Cell's note (`peers/PeerCard.tsx`) folds a long message by upstream's rule for the person's
 * own. A failure here after a sync names the rule that moved; a short note could fold behind
 * "Show full message", or a long one stand whole.
 */
import { describe, expect, it } from "vite-plus/test";

import { shouldCollapseUserMessage } from "./peers";

describe("a Cell's note folds as upstream folds the person's message", () => {
  it("stands a few sentences whole and folds a long or many-lined one", () => {
    expect(
      shouldCollapseUserMessage("I've deleted it, and about 8 GB is free again. Nothing else."),
    ).toBe(false);
    expect(shouldCollapseUserMessage("- Move one table.\n".repeat(12))).toBe(true);
    expect(shouldCollapseUserMessage("word ".repeat(200))).toBe(true);
  });
});
