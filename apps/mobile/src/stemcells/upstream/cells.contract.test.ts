import { describe, expect, it } from "vite-plus/test";

// The status the adapter hands on (`cells.ts`), from its module: the adapter also carries views Node cannot load.
import { resolveThreadListV2Status } from "../../features/threads/threadListV2";

/**
 * Contracts a Cell on the phone leans on. Its face reads T3's list status (`cell/mood.ts`):
 * which shells it calls asking, working and waiting.
 */

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
});
