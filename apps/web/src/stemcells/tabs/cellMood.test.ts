import { describe, expect, it } from "vite-plus/test";

import { asksYou, MOODS } from "../cell/look";
import { CELL_STATUSES } from "../upstream/status";
import { activityOfStatus, CHEER_MS, moodAt, moodTurnsAt, thinkingQuietly } from "./cellMood";

describe("a Cell's face from its chat's status", () => {
  it("is a face the art draws, for every status", () => {
    for (const status of [...CELL_STATUSES, null]) {
      expect(MOODS).toContain(moodAt(status, null, 0));
      expect(MOODS).toContain(moodAt(status, 0, 2));
    }
  });

  it("asks exactly while the chat waits on you, an approval with the original's own act", () => {
    const asking = CELL_STATUSES.filter((status) => asksYou(moodAt(status, 0, 0)));
    expect(asking).toEqual(["Pending Approval", "Awaiting Input", "Guest Request", "Plan Ready"]);
    expect(moodAt("Pending Approval", null, 0)).toBe("needsApproval");
    expect(moodAt("Awaiting Input", null, 0)).toBe("needsYou");
    // A guest's message to let through is an answer from you, not leave for the Cell to act.
    expect(moodAt("Guest Request", null, 0)).toBe("needsYou");
    expect(moodAt("Plan Ready", null, 0)).toBe("needsYou");
  });

  it("peers while its line is down, whatever the chat last said", () => {
    for (const status of [...CELL_STATUSES, null]) {
      expect(moodAt(status, 0, 2, true)).toBe("peering");
    }
  });

  it("crashes on a failed run, and is awake while it works", () => {
    expect(moodAt("Failed", null, 0)).toBe("crashed");
    expect(moodAt("Working", 0, 2)).toBe("awake");
    expect(moodAt("Connecting", null, 0)).toBe("awake");
    expect(moodAt(null, null, 0)).toBe("awake");
  });

  it("cheers as a turn lands, then rests awake however cold its prompt cache goes", () => {
    const landed = 1_000_000;
    expect(moodAt("Completed", landed, landed)).toBe("pleased");
    expect(moodAt(null, landed, landed + CHEER_MS - 1)).toBe("pleased");
    expect(moodAt("Completed", landed, landed + CHEER_MS)).toBe("awake");
    expect(moodAt(null, landed, landed + 24 * 60 * 60_000)).toBe("awake");
  });

  it("sleeps only while it is asleep, until its wake, and shows a raised hand even then", () => {
    const landed = 1_000_000;
    const wakes = landed + 60 * 60_000;
    expect(moodAt(null, landed, landed, false, Infinity)).toBe("asleep");
    expect(moodAt("Completed", landed, wakes - 1, false, wakes)).toBe("asleep");
    expect(moodAt("Completed", landed, wakes, false, wakes)).toBe("awake");
    expect(moodAt("Awaiting Input", landed, landed, false, Infinity)).toBe("needsYou");
    expect(moodAt("Failed", landed, landed, false, wakes)).toBe("crashed");
  });

  it("is looked at again when the cheer ends and when a timed sleep wakes, never while it works", () => {
    const landed = 1_000_000;
    const wakes = landed + 5 * 60_000;
    expect(moodTurnsAt(null, landed, landed)).toBe(landed + CHEER_MS);
    expect(moodTurnsAt("Completed", landed, landed + CHEER_MS)).toBeUndefined();
    expect(moodTurnsAt("Completed", landed, landed + CHEER_MS, wakes)).toBe(wakes);
    expect(moodTurnsAt(null, null, 0, Infinity)).toBeUndefined();
    expect(moodTurnsAt("Working", landed, landed, wakes)).toBeUndefined();
    expect(moodTurnsAt(null, null, 0)).toBeUndefined();
  });

  it("acts out only what the status says: waiting, or watching its subagents away", () => {
    expect(activityOfStatus("Waiting")).toBe("waiting");
    expect(activityOfStatus("Waiting", 1)).toBe("delegating");
    expect(activityOfStatus("Working")).toBeUndefined();
    expect(activityOfStatus("Completed", 1)).toBeUndefined();
  });
});

describe("thought gone deep, as the original's", () => {
  it("can come only while the Cell shows thinking and no call is in flight", () => {
    expect(thinkingQuietly("thinking", "thinking")).toBe(true);
    expect(thinkingQuietly("running", "thinking")).toBe(false);
    expect(thinkingQuietly("thinking", "reading")).toBe(false);
    expect(thinkingQuietly(undefined, undefined)).toBe(false);
  });
});
