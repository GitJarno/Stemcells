import { describe, expect, it } from "vite-plus/test";

import { readEvents } from "./stream";

describe("the needs stream, read as it arrives", () => {
  it("takes whole events and keeps a torn one for the next chunk", () => {
    const first = readEvents('data: {"needs":[]}\n\n: beat\n\ndata: {"nee');
    expect(first.lists).toEqual([{ needs: [] }]);
    const second = readEvents(`${first.rest}ds":[{"key":"a"}]}\n\n`);
    expect(second.lists).toEqual([{ needs: [{ key: "a" }] }]);
    expect(second.rest).toBe("");
  });

  it("skips what isn't a list rather than stop", () => {
    expect(readEvents("data: not json\n\ndata: {}\n\n").lists).toEqual([]);
  });
});
