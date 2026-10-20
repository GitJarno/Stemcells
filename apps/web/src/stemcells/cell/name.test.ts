import { describe, expect, it } from "vite-plus/test";

import { cellNameOf, NAMES } from "./name";

describe("a Cell's name", () => {
  it("is one of the names, the same every time for one chat", () => {
    const name = cellNameOf("3f2b8c1e-7d4a-4e5f-9a6b-1c2d3e4f5a6b");
    expect(NAMES).toContain(name);
    expect(cellNameOf("3f2b8c1e-7d4a-4e5f-9a6b-1c2d3e4f5a6b")).toBe(name);
  });

  // FNV-1a over the id's UTF-8, into the names in order: a change to either
  // renames every Cell a person already knows.
  it("keeps the name a chat was dealt", () => {
    expect(cellNameOf("3f2b8c1e-7d4a-4e5f-9a6b-1c2d3e4f5a6b")).toBe("Manatee");
    expect(cellNameOf("thread-1")).toBe("Bison");
    expect(cellNameOf("thread-2")).toBe("Noodle");
    expect(cellNameOf("ünïcode-id")).toBe("Jester");
  });

  it("can be said and written back: no two names alike but for case, none ending in a digit", () => {
    expect(new Set(NAMES.map((name) => name.toLowerCase())).size).toBe(NAMES.length);
    expect(NAMES.filter((name) => /\d$/.test(name))).toEqual([]);
  });
});
