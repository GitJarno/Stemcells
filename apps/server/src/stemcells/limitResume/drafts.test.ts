import { describe, expect, it } from "vite-plus/test";

import { DRAFTS_LAST_MS, makeDrafts } from "./drafts.ts";

describe("the drafts the person's screens report", () => {
  it("joins every screen's list, each replacing its own last one", () => {
    const drafts = makeDrafts();
    drafts.report("screen-mac", ["thread-otter", "thread-heron"], 0);
    drafts.report("screen-phone", ["thread-wren"], 0);
    drafts.report("screen-mac", ["thread-otter"], 1);
    expect([...drafts.current(1)].toSorted()).toEqual(["thread-otter", "thread-wren"]);
    drafts.report("screen-phone", [], 2);
    expect([...drafts.current(2)]).toEqual(["thread-otter"]);
  });

  it("lets a screen's list lapse once it stops reporting: a closed window holds nothing", () => {
    const drafts = makeDrafts();
    drafts.report("screen-mac", ["thread-otter"], 0);
    expect(drafts.current(DRAFTS_LAST_MS).has("thread-otter")).toBe(true);
    expect(drafts.current(DRAFTS_LAST_MS + 1).size).toBe(0);
  });

  it("still knows, after a sleep, which screens had drafts standing before it", () => {
    const drafts = makeDrafts();
    drafts.report("screen-mac", ["thread-otter"], 0);
    drafts.report("screen-old", ["thread-heron"], -10 * DRAFTS_LAST_MS);
    const asleepAt = 10_000;
    const wokeAt = asleepAt + 3_600_000;
    expect(drafts.current(wokeAt).size).toBe(0);
    expect([...drafts.standing(asleepAt)]).toEqual(["screen-mac"]);
    expect(drafts.heard("screen-mac")).toBe(0);
    drafts.report("screen-mac", [], wokeAt + 5_000);
    expect(drafts.heard("screen-mac")).toBe(wokeAt + 5_000);
    expect(drafts.heard("screen-never")).toBeNull();
  });
});
