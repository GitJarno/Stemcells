import { describe, expect, it } from "vite-plus/test";

import { follows, lastCompletedRun, settledReply } from "./reply.ts";
import { message, run } from "./suggestions.fixture.ts";

describe("lastCompletedRun", () => {
  it("is the last run once it completed and nothing waits behind it", () => {
    const first = run(1, "completed", 0);
    const second = run(2, "completed", 60_000);
    expect(lastCompletedRun([first, second])).toBe(second);
    expect(lastCompletedRun([first, run(2, "queued", 60_000)])).toBeNull();
    expect(lastCompletedRun([first, run(2, "running", 60_000)])).toBeNull();
  });

  it("skips a rolled-back run, and gives none after a failed or stopped one", () => {
    const first = run(1, "completed", 0);
    expect(lastCompletedRun([first, run(2, "rolled_back", 60_000)])).toBe(first);
    expect(lastCompletedRun([first, run(2, "failed", 60_000)])).toBeNull();
    expect(lastCompletedRun([first, run(2, "interrupted", 60_000)])).toBeNull();
  });
});

describe("settledReply", () => {
  it("is the run's last reply when the page asked for it and it's done streaming", () => {
    const replies = [
      message("m-1", "assistant", "Looking.", 0),
      message("m-2", "assistant", "Done.", 1),
    ];
    expect(settledReply(replies, message("m-2", "assistant", "", 0).id)).toBe("Done.");
    expect(settledReply(replies, message("m-1", "assistant", "", 0).id)).toBeNull();
    const streaming = [{ ...replies[1]!, streaming: true }];
    expect(settledReply(streaming, replies[1]!.id)).toBeNull();
  });
});

describe("follows", () => {
  it("takes a suggestion that came after the run began, with no run begun in between", () => {
    const first = run(1, "completed", 0);
    const second = run(2, "rolled_back", 60_000);
    expect(follows([first], first, 30_000)).toBe(true);
    expect(follows([first, second], first, 30_000)).toBe(true);
    // It came after a later run began: it answers that one, rolled back or not.
    expect(follows([first, second], first, 90_000)).toBe(false);
    expect(follows([first], first, -1)).toBe(false);
  });
});
