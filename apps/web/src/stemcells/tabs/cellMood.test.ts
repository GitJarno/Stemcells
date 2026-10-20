import { describe, expect, it } from "vite-plus/test";

import { MOODS } from "../cell/look";
import { CELL_STATUSES } from "../upstream/status";
import { activityOfStatus, moodOfStatus } from "./cellMood";

describe("a Cell's face from its chat's status", () => {
  it("is a face the art draws, for every status", () => {
    for (const status of [...CELL_STATUSES, null]) {
      expect(MOODS).toContain(moodOfStatus(status));
    }
  });

  it("needs you exactly while the chat waits on you", () => {
    const needsYou = CELL_STATUSES.filter((status) => moodOfStatus(status) === "needsYou");
    expect(needsYou).toEqual(["Pending Approval", "Awaiting Input", "Plan Ready"]);
  });

  it("crashes on a failed run, is pleased once landed, else awake", () => {
    expect(moodOfStatus("Failed")).toBe("crashed");
    expect(moodOfStatus("Completed")).toBe("pleased");
    expect(moodOfStatus("Working")).toBe("awake");
    expect(moodOfStatus("Connecting")).toBe("awake");
    expect(moodOfStatus(null)).toBe("awake");
  });

  it("acts out only what the status says: waiting", () => {
    expect(activityOfStatus("Waiting")).toBe("waiting");
    expect(activityOfStatus("Working")).toBeUndefined();
  });
});
