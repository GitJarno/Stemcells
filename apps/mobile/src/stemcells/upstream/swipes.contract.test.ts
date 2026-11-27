import { describe, expect, it } from "vite-plus/test";

import { resolveThreadListV2SwipeActions } from "../../features/threads/threadListV2";
import { swipeEdgeOf } from "../home/swipes";

const row = { settlementSupported: true, snoozeSupported: true, snoozable: true } as const;
const edgeOf = (input: Parameters<typeof resolveThreadListV2SwipeActions>[0]) =>
  swipeEdgeOf(resolveThreadListV2SwipeActions(input).primary);

/** The edge a row's swipe stands on goes by T3's name for its main action (`home/swipes.ts`). */
describe("which way a Cell's row swipes", () => {
  it("sleeps an awake Cell on a swipe right, toward Asleep, with Snooze on the left", () => {
    expect(edgeOf({ ...row, variant: "card" })).toBe("leading");
    expect(resolveThreadListV2SwipeActions({ ...row, variant: "card" }).secondary).toBe("snooze");
  });

  it("wakes a settled or snoozed Cell on a swipe left, toward Awake", () => {
    expect(edgeOf({ ...row, variant: "slim" })).toBe("trailing");
    expect(edgeOf({ ...row, variant: "slim", snoozed: true })).toBe("trailing");
  });
});
