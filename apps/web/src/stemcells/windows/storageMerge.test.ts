import { describe, expect, it } from "vite-plus/test";

import { EntryVersions, KEPT_DELETIONS, spliceTheirs, versionsOf } from "./storageMerge";

describe("EntryVersions", () => {
  const before = { drafts: { a: "a0", b: "b0" }, sticky: "x" };

  it("gives a new version only to what this window changed, a deletion too", () => {
    const here = new EntryVersions("here", before);
    expect(here.stamp(before)).toEqual({});
    expect(here.stamp({ drafts: { a: "a1" }, sticky: "x" })).toEqual({
      drafts: { a: [1, "here"], b: [2, "here"] },
    });
    expect(here.stamp({ drafts: { a: "a1" }, sticky: "y" })).toEqual({
      drafts: { a: [1, "here"], b: [2, "here"] },
      sticky: [3, "here"],
    });
  });

  it("takes only what is newer, so a bystander's echo of an older write never wins", () => {
    const b = new EntryVersions("b", {});
    const c = new EntryVersions("c", {});
    const a = new EntryVersions("a", {});
    // C and B type at once, each in its own chat.
    const fromC = {
      fields: { drafts: { c: "typed in C" } },
      clocks: c.stamp({ drafts: { c: "typed in C" } }),
    };
    const fromB = {
      fields: { drafts: { b: "typed in B" } },
      clocks: b.stamp({ drafts: { b: "typed in B" } }),
    };
    // A hears C and passes it on, not having heard B.
    expect(a.newerIn(fromC)).toEqual([["drafts", "c"]]);
    a.held([["drafts", "c"]], fromC.fields);
    const fromA = { fields: fromC.fields, clocks: a.stamp(fromC.fields) };
    // C hears B, then A: A has nothing newer for b.
    expect(c.newerIn(fromB)).toEqual([["drafts", "b"]]);
    const both = { drafts: { b: "typed in B", c: "typed in C" } };
    c.held([["drafts", "b"]], both);
    expect(c.newerIn(fromA)).toEqual([]);
    // B hears what C wrote then: only c is new to it.
    expect(b.newerIn({ fields: both, clocks: c.stamp(both) })).toEqual([["drafts", "c"]]);
  });

  it("holds a newer version of a value it already has without taking anything", () => {
    const here = new EntryVersions("here", before);
    expect(here.newerIn({ fields: before, clocks: { sticky: [5, "there"] } })).toEqual([]);
    // Its own next change goes past the version it heard.
    expect(here.stamp({ ...before, sticky: "z" })).toEqual({ sticky: [6, "here"] });
  });

  it("holds no versions until it hears one, so whatever it hears with one is newer", () => {
    const here = new EntryVersions("here", before);
    const onDisk = {
      fields: { ...before, sticky: "newer" },
      clocks: { sticky: [7, "there"] as const },
    };
    expect(here.newerIn(onDisk)).toEqual([["sticky"]]);
    here.held([["sticky"]], onDisk.fields);
    expect(
      here.newerIn({ fields: { ...before, sticky: "old" }, clocks: { sticky: [6, "old"] } }),
    ).toEqual([]);
    expect(here.stamp({ ...before, sticky: "z" })).toEqual({ sticky: [8, "here"] });
  });

  it("keeps the versions of only the latest deletions", () => {
    const many = Object.fromEntries(
      Array.from({ length: KEPT_DELETIONS + 2 }, (_, index) => [`chat ${index}`, "typed"]),
    );
    const here = new EntryVersions("here", { drafts: many });
    const clocks = here.stamp({ drafts: {} }) as { drafts: Record<string, unknown> };
    expect(Object.keys(clocks.drafts)).toHaveLength(KEPT_DELETIONS);
    expect(clocks.drafts).not.toHaveProperty("chat 0");
  });

  it("reads nothing from versions that aren't", () => {
    expect(versionsOf(null).size).toBe(0);
    expect([...versionsOf({ a: [1, "x"], b: { c: [2, "y"], d: "no" }, e: [1] })]).toEqual([
      ["a", [1, "x"]],
      ["b\u0000c", [2, "y"]],
    ]);
  });
});

describe("spliceTheirs", () => {
  it("sets and deletes only at the paths, keeping this window's other objects", () => {
    const kept = { live: true };
    const current = { drafts: { a: kept, b: { live: true } }, sticky: "x", other: 1 };
    const hydrated = { drafts: { c: { live: false } }, sticky: "y" };
    const next = spliceTheirs(current, hydrated, [["drafts", "b"], ["drafts", "c"], ["sticky"]]);
    expect(next).toEqual({ drafts: { a: kept, c: { live: false } }, sticky: "y", other: 1 });
    expect(next.drafts.a).toBe(kept);
    expect(current.drafts).toHaveProperty("b");
  });
});
