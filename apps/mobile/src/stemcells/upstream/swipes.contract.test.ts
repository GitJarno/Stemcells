import { describe, expect, it } from "vite-plus/test";

import { resolveThreadListV2SwipeActions } from "../../features/threads/threadListV2";
import { swipeEdgeOf } from "../home/swipes";

const row = { settlementSupported: true, snoozeSupported: true, snoozable: true } as const;
const edgeOf = (input: Parameters<typeof resolveThreadListV2SwipeActions>[0]) =>
  swipeEdgeOf(resolveThreadListV2SwipeActions(input).primary);

/** The edge a card's swipe stands on goes by T3's name for its main action (`home/swipes.ts`). */
describe("which way a Cell's card swipes", () => {
  it("settles on a swipe right, toward Settled", () => {
    expect(edgeOf({ ...row, variant: "card" })).toBe("leading");
  });

  it("brings a settled or snoozed Cell back on a swipe left, toward Landed", () => {
    expect(edgeOf({ ...row, variant: "slim" })).toBe("trailing");
    expect(edgeOf({ ...row, variant: "slim", snoozed: true })).toBe("trailing");
  });
});
