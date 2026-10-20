import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import look from "./cell.json" with { type: "json" };
import { coreOf, lineMarks, MOODS, moodOf, orbOf, path, pixels, SIZE } from "./look.ts";

const filled = (x: number, y: number) => look.body[y]?.[x] === "#";

test("the look file draws every mood the product names, its eyes cut from inside the body, each face its own", () => {
  NodeAssert.deepEqual([...MOODS].sort(), [
    "asleep",
    "awake",
    "braced",
    "crashed",
    "needsYou",
    "pleased",
  ]);
  NodeAssert.ok(
    look.body.every((r) => r.length === SIZE.width),
    "every row of the body is as wide as the first",
  );
  const body = [...look.body.join("")].filter((p) => p === "#").length;
  const faces = new Set<string>();
  for (const mood of MOODS) {
    const drawn = pixels(mood);
    NodeAssert.ok(
      drawn.every(([x, y]) => filled(x, y)),
      `${mood}: nothing drawn outside the body`,
    );
    NodeAssert.ok(drawn.length < body, `${mood}: its eyes show`);
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
