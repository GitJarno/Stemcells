import * as NodeAssert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import { dressesFor, looksOf, seasonOn } from "./looks.ts";

// The deal over the kit's packs (`kit/packs.json`) alone: packs drawn in `art/` bring their
// own seasons and the Cells' own looks, and are tested with their own data.
vi.mock("./art.ts", () => ({ ART_PACKS: {}, ART_MOVES: {}, ART_TEMPERAMENTS: {} }));

const ROSTER = [
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

test.each([
  ["a day in no season", "08-15", undefined],
  ["a window's first day", "10-15", "halloween"],
  ["a window's last day", "11-01", "halloween"],
  ["the day after a window", "11-02", undefined],
  ["the narrower of two windows", "12-24", "christmas"],
  ["a window that runs over the new year", "12-30", "newyear"],
  ["the wider season once the narrower has passed", "01-02", "winter"],
])("the season on %s", (_says, day, season) => {
  NodeAssert.equal(seasonOn(day), season);
});

test("on a feast every Cell wears one of the season's pieces, no two the same while they last", () => {
  const worn = [...looksOf(ROSTER.slice(0, 6), "10-19").values()].map((look) => look.worn);
  NodeAssert.ok(worn.every((ids) => ids.length === 1 && ids[0]!.startsWith("halloween/")));
  NodeAssert.equal(new Set(worn.map((ids) => ids[0])).size, 6);
});

test("out of season, and with no look of its own, a Cell wears nothing", () => {
  NodeAssert.deepEqual(looksOf(["Otter"], "08-15").get("Otter"), { worn: [] });
});

test("through a longer season a Cell dresses for it one day in three, on days of its own", () => {
  const days = Array.from({ length: 30 }, (_, i) => `2027-01-${String(i + 2).padStart(2, "0")}`);
  const dressed = (codename: string) =>
    days.filter((day) => looksOf([codename], day).get(codename)!.worn.length > 0);
  const all = ROSTER.map(dressed);
  const share = all.reduce((sum, own) => sum + own.length, 0) / (ROSTER.length * days.length);
  NodeAssert.ok(share > 0.25 && share < 0.42, `a share of ${share}`);
  NodeAssert.ok(new Set(all.map((own) => own.join(","))).size > ROSTER.length / 2);
  for (const day of dressed("Otter")) NodeAssert.ok(dressesFor("Otter", "winter", day));
});

test("a Cell arriving never changes what the Cells before it wear", () => {
  for (const day of ["10-19", "12-01"]) {
    const all = looksOf(ROSTER, day);
    for (let seated = 1; seated < ROSTER.length; seated++) {
      for (const [codename, look] of looksOf(ROSTER.slice(0, seated), day)) {
        NodeAssert.deepEqual(
          all.get(codename),
          look,
          `${codename} on ${day} with ${seated} seated`,
        );
      }
    }
  }
});

test("a Cell keeps its piece while those born before it leave, and the next to arrive takes a free one", () => {
  const roster = ROSTER.slice(0, 6);
  const before = looksOf(roster, "10-19");
  const left = roster.filter((c) => c !== "Otter" && c !== "Puffin");
  const after = looksOf([...left, "Gannet"], "10-19", before);
  for (const codename of left)
    NodeAssert.deepEqual(after.get(codename), before.get(codename), codename);
  const taken = left.map((c) => before.get(c)?.worn[0]);
  NodeAssert.ok(
    !taken.includes(after.get("Gannet")?.worn[0]),
    "the newcomer wears a piece no one else does",
  );
});
