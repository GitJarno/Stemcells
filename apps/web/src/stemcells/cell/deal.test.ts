import * as NodeAssert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import fixtureJson from "./fixtures/looks.json" with { type: "json" };
import { type Dress, looksOf } from "./looks.ts";

// The fixture is the deal over the kit's packs (`kit/packs.json`): packs drawn
// in `art/` bring their own seasons and are tested with their own data.
vi.mock("./art.ts", () => ({ ART_PACKS: {}, ART_MOVES: {}, ART_TEMPERAMENTS: {} }));

interface Case {
  readonly says: string;
  readonly cells: string[];
  readonly day: string;
  readonly dress?: Dress;
  readonly looks: Record<string, string[]>;
}

const fixture = fixtureJson as { cases: Case[] };

test.each(fixture.cases)("$says", (c) => {
  const looks = looksOf(c.cells, c.day, new Map(), c.dress);
  NodeAssert.deepEqual(
    Object.fromEntries([...looks].map(([codename, look]) => [codename, look.worn])),
    c.looks,
  );
});

test("a Cell arriving never changes what the Cells before it wear", () => {
  const roster = [
    "Otter",
    "Puffin",
    "Wren",
    "Heron",
    "Marten",
    "Lark",
    "Gannet",
    "Plover",
    "Stoat",
    "Vole",
  ];
  for (const day of ["10-19", "12-01"]) {
    const all = looksOf(roster, day);
    for (let seated = 1; seated < roster.length; seated++) {
      for (const [codename, look] of looksOf(roster.slice(0, seated), day)) {
        NodeAssert.deepEqual(
          all.get(codename),
          look,
          `${codename} on ${day} with ${seated} seated`,
        );
      }
    }
  }
});

test("a Cell keeps its look while those born before it leave, and the next to arrive takes a free piece", () => {
  const roster = ["Otter", "Puffin", "Wren", "Heron", "Marten", "Lark"];
  const before = looksOf(roster, "12-01");
  const left = roster.filter((c) => c !== "Otter" && c !== "Puffin");
  const after = looksOf([...left, "Gannet"], "12-01", before);
  for (const codename of left)
    NodeAssert.deepEqual(after.get(codename), before.get(codename), codename);
  const taken = left.map((c) => before.get(c)?.worn[0]);
  NodeAssert.ok(
    !taken.includes(after.get("Gannet")?.worn[0]),
    "the newcomer wears a piece no one else does",
  );
});
