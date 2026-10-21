import { describe, expect, it } from "vite-plus/test";

import { asksYou, MOODS } from "../cell/look";
import { CELL_STATUSES } from "../upstream/status";
import { activityOfStatus, CHEER_MS, moodAt, moodTurnsAt, thinkingQuietly } from "./cellMood";

describe("a Cell's face from its chat's status", () => {
  it("is a face the art draws, for every status", () => {
    for (const status of [...CELL_STATUSES, null]) {
      expect(MOODS).toContain(moodAt(status, null, undefined, 0));
      expect(MOODS).toContain(moodAt(status, 0, 1, 2));
    }
  });

  it("asks exactly while the chat waits on you, an approval with the original's own act", () => {
    const asking = CELL_STATUSES.filter((status) => asksYou(moodAt(status, 0, undefined, 0)));
    expect(asking).toEqual(["Pending Approval", "Awaiting Input", "Plan Ready"]);
    expect(moodAt("Pending Approval", null, undefined, 0)).toBe("needsApproval");
    expect(moodAt("Awaiting Input", null, undefined, 0)).toBe("needsYou");
    expect(moodAt("Plan Ready", null, undefined, 0)).toBe("needsYou");
  });

  it("peers while its line is down, whatever the chat last said", () => {
    for (const status of [...CELL_STATUSES, null]) {
      expect(moodAt(status, 0, 1, 2, true)).toBe("peering");
    }
  });

  it("crashes on a failed run, and is awake while it works", () => {
    expect(moodAt("Failed", null, undefined, 0)).toBe("crashed");
    expect(moodAt("Working", 0, 1, 2)).toBe("awake");
    expect(moodAt("Connecting", null, undefined, 0)).toBe("awake");
    expect(moodAt(null, null, undefined, 0)).toBe("awake");
  });

  it("cheers as a turn lands, rests awake after, and sleeps once the prompt cache is cold", () => {
    const landed = 1_000_000;
    const cold = landed + 60 * 60_000;
    expect(moodAt("Completed", landed, cold, landed)).toBe("pleased");
    expect(moodAt(null, landed, cold, landed + CHEER_MS - 1)).toBe("pleased");
    expect(moodAt("Completed", landed, cold, landed + CHEER_MS)).toBe("awake");
    expect(moodAt(null, landed, cold, cold - 1)).toBe("awake");
    expect(moodAt(null, landed, cold, cold)).toBe("asleep");
    expect(moodAt("Working", landed, cold, cold)).toBe("awake");
  });

  it("never sleeps when nothing says when the cache goes cold", () => {
    const landed = 1_000_000;
    expect(moodAt(null, landed, undefined, landed + 24 * 60 * 60_000)).toBe("awake");
    expect(moodTurnsAt(null, landed, undefined, landed + CHEER_MS)).toBeUndefined();
  });

  it("cheers its whole cheer even when the cache went cold during the turn", () => {
    const landed = 1_000_000;
    expect(moodAt(null, landed, landed - 1, landed)).toBe("pleased");
    expect(moodTurnsAt(null, landed, landed - 1, landed)).toBe(landed + CHEER_MS);
    expect(moodAt(null, landed, landed - 1, landed + CHEER_MS)).toBe("asleep");
  });

  it("is looked at again when the cheer ends and when the cache goes cold, never while it works", () => {
    const landed = 1_000_000;
    const cold = landed + 5 * 60_000;
    expect(moodTurnsAt(null, landed, cold, landed)).toBe(landed + CHEER_MS);
    expect(moodTurnsAt("Completed", landed, cold, landed + CHEER_MS)).toBe(cold);
    expect(moodTurnsAt(null, landed, cold, cold)).toBeUndefined();
    expect(moodTurnsAt("Working", landed, cold, landed)).toBeUndefined();
    expect(moodTurnsAt(null, null, undefined, 0)).toBeUndefined();
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
