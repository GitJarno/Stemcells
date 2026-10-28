import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

// The status the adapter hands on (`cells.ts`), from its module: the adapter also carries views Node cannot load.
import { resolveThreadListV2Status } from "../../features/threads/threadListV2";

/**
 * Contracts a Cell on the phone leans on. Its face reads T3's list status (`cell/mood.ts`):
 * which shells it calls asking, working and waiting. Its ledge adds its height to what the
 * composer reports, and the chat clears its feed by that report (`ledge/CellLedge.tsx`); if
 * the chat stopped reading it, the ledge would cover the last message.
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));

const quiet = {
  hasPendingApprovals: false,
  hasPendingUserInput: false,
  pendingSubagentRequest: null,
  runtime: null,
  blockedOnThreadWait: false,
} as const;

describe("what a Cell's face is read from", () => {
  it("T3's list status: asking, working, waiting, failed", () => {
    expect(resolveThreadListV2Status({ ...quiet, hasPendingApprovals: true })).toBe("approval");
    expect(resolveThreadListV2Status({ ...quiet, hasPendingUserInput: true })).toBe("input");
    expect(resolveThreadListV2Status({ ...quiet, runtime: { status: "running" } as never })).toBe(
      "working",
    );
    expect(
      resolveThreadListV2Status({
        ...quiet,
        runtime: { status: "running" } as never,
        blockedOnThreadWait: true,
      }),
    ).toBe("waiting");
    expect(resolveThreadListV2Status({ ...quiet, runtime: { status: "idle" } as never })).toBe(
      "waiting",
    );
    expect(resolveThreadListV2Status({ ...quiet, runtime: { status: "failed" } as never })).toBe(
      "failed",
    );
  });

  it("the chat clears its feed by the height the composer reports", () => {
    const screen = NodeFS.readFileSync(
      NodePath.join(here, "../../features/threads/ThreadDetailScreen.tsx"),
      "utf8",
    );
    // Upstream settles the report before it lays the feed out again, but still lays it out by it.
    expect(screen).toMatch(/onHeightChange=\{handleComposerHeightChange\}/);
    expect(screen).toMatch(
      /const handleComposerHeightChange = \(height: number\) => \{[\s\S]*?setComposerHeight\(height\);/,
    );
    expect(screen).toMatch(/const composerOverlapHeight =\s*composerHeight \?\?/);
  });
});
