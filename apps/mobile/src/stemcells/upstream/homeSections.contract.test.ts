import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

/**
 * Contract: the home's tabs are its only sections. A queued Cell stands in Flying's line under no
 * heading of T3's, and T3's shelf headers still ask us before they draw.
 */

const list = NodeFS.readFileSync(
  new URL("../../features/threads/thread-list-v2-items.tsx", import.meta.url),
  "utf8",
);

describe("T3's list on the home", () => {
  it("heads no queued row", () => {
    expect(list).not.toContain('label="Unsent"');
    expect(list).toContain("<QueuedCellBesideRow task={pendingTask}>");
  });

  it("draws a shelf header only where we say", () => {
    expect(list).toContain("if (!useShelfHeadersShown()) return null;");
  });
});
