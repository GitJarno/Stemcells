import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { CommandOutcome, ThreadCommand } from "../upstream/needs";
import { needFixture } from "./fixtures";
import { createHolds } from "./holds";
import type { NeedsState } from "./stream";

const WINDOW = 3_000;
const decline: ThreadCommand = { type: "respond", requestId: "request-1", decision: "decline" };
const note: ThreadCommand = { type: "message", text: "use staging" };

function setup(outcomes: CommandOutcome[] = []) {
  let state: NeedsState = { needs: [needFixture()], live: true };
  const sent: ThreadCommand[] = [];
  let kept = 0;
  const holds = createHolds({
    send: async (_threadId, command) => {
      sent.push(command);
      return outcomes.shift() ?? { ok: true };
    },
    needs: () => state,
    keepLive: () => (kept++, () => void kept--),
    now: () => Date.now(),
    window: () => WINDOW,
  });
  const hold = (commands: ThreadCommand[] = [decline]) =>
    holds.hold({ key: needFixture().key, threadId: "thread-floof", label: "Decline", commands });
  return {
    holds,
    hold,
    sent,
    kept: () => kept,
    setNeeds: (next: NeedsState) => void (state = next),
    stateOf: () => holds.read().get(needFixture().key)?.state,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("an answer waits out the undo window", () => {
  it("sends nothing until the fuse ends, then sends every command in order", async () => {
    const t = setup();
    t.hold([decline, note]);
    await vi.advanceTimersByTimeAsync(WINDOW - 1);
    expect(t.sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.sent).toEqual([decline, note]);
    expect(t.stateOf()).toBe("sent");
  });

  it("sends nothing once undone", async () => {
    const t = setup();
    t.hold();
    expect(t.holds.undoNewest()).toBe(true);
    await vi.advanceTimersByTimeAsync(WINDOW);
    expect(t.sent).toEqual([]);
    expect(t.stateOf()).toBeUndefined();
  });

  it("sends nothing when the need left meanwhile: answered elsewhere, or asked again", async () => {
    const t = setup();
    t.hold();
    t.setNeeds({ needs: [needFixture({ key: "thread-floof:request:request-2" })], live: true });
    await vi.advanceTimersByTimeAsync(WINDOW);
    expect(t.sent).toEqual([]);
    expect(t.stateOf()).toBe("stale");
  });

  it("sends nothing on a list it can't trust, and says so", async () => {
    const t = setup();
    t.hold();
    t.setNeeds({ needs: [needFixture()], live: false });
    await vi.advanceTimersByTimeAsync(WINDOW);
    expect(t.sent).toEqual([]);
    expect(t.stateOf()).toBe("failed");
  });

  it("stops at the first command that fails, so a note never follows a refused decline", async () => {
    const t = setup([{ ok: false, why: "already answered" }]);
    t.hold([decline, note]);
    await vi.advanceTimersByTimeAsync(WINDOW);
    expect(t.sent).toEqual([decline]);
    expect(t.holds.read().get(needFixture().key)?.why).toBe("Couldn't send: already answered");
  });

  it("sends what is held at once when the window closes", async () => {
    const t = setup();
    t.hold();
    t.holds.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.sent).toEqual([decline]);
  });

  it("keeps the list live only while an answer waits on it", async () => {
    const t = setup();
    t.hold();
    expect(t.kept()).toBe(1);
    await vi.advanceTimersByTimeAsync(WINDOW);
    expect(t.kept()).toBe(0);
  });
});
