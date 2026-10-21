/**
 * In a 300 px pane a tool row showed "update /Users/example/pri…": the
 * start of a folder, never the file. These pin how a row's label splits so
 * the file's name comes first.
 */
import { describe, expect, it } from "vite-plus/test";

import { splitPathLabel } from "./pathLabel";

describe("a tool row's label, file first", () => {
  it("splits a path into the file's name and its folder", () => {
    expect(splitPathLabel("garden/notes.md")).toEqual({
      verb: null,
      name: "notes.md",
      folder: "garden",
      more: null,
    });
  });

  it("keeps a verb before the path, and upstream's count after it", () => {
    expect(splitPathLabel("update /Users/example/garden/notes.md")).toEqual({
      verb: "update",
      name: "notes.md",
      folder: "/Users/example/garden",
      more: null,
    });
    expect(splitPathLabel("garden/notes.md +2 more")?.more).toBe("+2 more");
  });

  it("keeps a line position with the name, and spaces in folders", () => {
    expect(splitPathLabel("/Users/example/My Plants/care.ts:12")).toMatchObject({
      name: "care.ts:12",
      folder: "/Users/example/My Plants",
    });
  });

  it("leaves a label that isn't one path as it was", () => {
    expect(splitPathLabel("Read file")).toBeNull();
    expect(splitPathLabel("sed -n 1,20p garden/notes.md")).toBeNull();
    expect(splitPathLabel("cp garden/a.md garden/b.md")).toBeNull();
    expect(splitPathLabel("update /a/b.md and /c/d.md")).toBeNull();
    expect(splitPathLabel("garden/")).toBeNull();
  });
});
