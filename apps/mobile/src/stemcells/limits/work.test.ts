import { describe, expect, it } from "vite-plus/test";

import { workKey, workOfKey } from "./work";

describe("the chats' work as the ring's key", () => {
  it("reads back what it wrote, instances with spaces and colons included", () => {
    const work = {
      working: new Map([
        ["env-1:claude", 2],
        ["env 2:codex work", 1],
      ]),
      lastWritten: "env 2:codex work",
    };
    expect(workOfKey(workKey(work))).toEqual(work);
  });

  it("reads none written to and none at work", () => {
    const work = { working: new Map<string, number>(), lastWritten: null };
    expect(workOfKey(workKey(work))).toEqual(work);
  });
});
