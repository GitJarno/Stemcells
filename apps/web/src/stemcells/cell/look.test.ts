import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { coreOf, lineMarks, MOODS, moodOf, orbOf, path, SIZE } from "./look.ts";

/** The unit cells a mark's path fills, as `x,y` keys. */
function cells(d: string): Set<string> {
  const out = new Set<string>();
  for (const [, x, y, run] of d.matchAll(/M(\d+) (\d+)h(\d+)/g)) {
    for (let dx = 0; dx < Number(run); dx++) out.add(`${Number(x) + dx},${y}`);
  }
  return out;
}

test("the Cell as a mark wears a face of its own in every mood the product names, inside its box", () => {
  NodeAssert.deepEqual([...MOODS].sort(), [
    "asleep",
    "awake",
    "braced",
    "crashed",
    "meditating",
    "needsYou",
    "pleased",
  ]);
  const faces = new Set<string>();
  for (const mood of MOODS) {
    const filled = [...cells(path(mood))].map((key) => key.split(",").map(Number));
    NodeAssert.ok(filled.length > 0, `${mood}: drawn`);
    NodeAssert.ok(
      filled.every(([x = -1, y = -1]) => x >= 0 && x < SIZE.width && y >= 0 && y < SIZE.height),
      `${mood}: nothing drawn outside the mark's box`,
    );
    faces.add(path(mood));
  }
  NodeAssert.equal(faces.size, MOODS.length, "no two moods look alike");
});

test("a mood the screen does not know draws as awake", () => {
  NodeAssert.equal(moodOf("dancing"), "awake");
  NodeAssert.equal(moodOf(undefined), "awake");
  NodeAssert.equal(moodOf("braced"), "braced");
});

test("the orb marks a stage: a dim ring starting, a working ring, the amber dot, the unread dot, nothing once read", () => {
  NodeAssert.deepEqual(orbOf("starting", false), { shape: "ring", tone: "dim" });
  NodeAssert.deepEqual(orbOf("working", false), { shape: "ring", tone: "working" });
  NodeAssert.deepEqual(orbOf("needsYou", false), { shape: "dot", tone: "needsYou" });
  NodeAssert.deepEqual(orbOf("landed", true), { shape: "dot", tone: "working" });
  NodeAssert.equal(orbOf("landed", false), undefined);
});

test("a project's line marks each Cell by shape: a core starting or working, the core with ? asking, a dot landed unread, a faint dot read", () => {
  NodeAssert.equal(coreOf("starting", false), "core");
  NodeAssert.equal(coreOf("working", false), "core");
  NodeAssert.equal(coreOf("needsYou", false), "asks");
  NodeAssert.equal(coreOf("landed", true), "unread");
  NodeAssert.equal(coreOf("landed", false), "read");
});

test("a project's line keeps what asks in front of its cores and its dots after them, three at most", () => {
  const cell = (name: string, stage: string, bornAt: number, unread = false) => ({
    name,
    stage,
    bornAt,
    unread,
  });
  const line = [
    cell("read", "landed", 1),
    cell("asks", "needsYou", 2),
    cell("old", "working", 3),
    cell("new", "working", 4),
    cell("unread", "landed", 5, true),
  ];
  NodeAssert.deepEqual(
    lineMarks(line, 3).map((c) => c.name),
    ["old", "new", "asks"],
    "what asks is kept first and drawn in front; the newest at work before the landed",
  );
  NodeAssert.deepEqual(
    lineMarks([line[0]!, line[2]!, line[4]!], 3).map((c) => c.name),
    ["old", "unread", "read"],
    "the dots stand after the cores",
  );
});
