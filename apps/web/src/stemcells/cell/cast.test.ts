import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { ACTIVITIES } from "./activity.ts";
import { blinkStart } from "./blink.ts";
import { bodyOf, frameShown, pictureOf, sceneFor } from "./cast.ts";
import { BODIES, PACKS } from "./kit.ts";
import { BOX, MOODS } from "./look.ts";
import { MARGIN, packLook, sceneOf } from "./scene.ts";
import { crop } from "./sprite.ts";

const bare = packLook([]);

test("every mood plays a scene of its own, and a Cell at work acts out each activity", () => {
  const scenes = new Set([
    ...MOODS.map((mood) => sceneFor(bare, mood, undefined, 0)),
    ...ACTIVITIES.map((activity) => sceneFor(bare, "awake", activity, 0)),
  ]);
  NodeAssert.equal(scenes.size, MOODS.length + ACTIVITIES.length);
  NodeAssert.equal(sceneFor(bare, "needsYou", undefined, 0), sceneOf(bare, "waiting"));
  NodeAssert.equal(sceneFor(bare, "pleased", undefined, 0), sceneOf(bare, "happy"));
  NodeAssert.equal(sceneFor(bare, "meditating", "thinking", 12), sceneOf(bare, "meditating"));
  NodeAssert.equal(
    sceneFor(bare, "meditating", "thinking", 0),
    sceneOf(bare, "meditating/still"),
    "held still with no clock, it sits on its shadow",
  );
});

// A test per pack: composing every piece's every mood is seconds of CPU, near the
// project's timeout on a CI runner when it was one test.
test.each(PACKS.map((pack) => [pack.theme, pack] as const))(
  "every piece of %s a Cell can be dealt plays every mood",
  (_, pack) => {
    for (const piece of pack.pieces) {
      const look = packLook([`${piece.theme}/${piece.name}`]);
      for (const mood of MOODS) {
        const scene = sceneFor(look, mood, undefined, 0);
        NodeAssert.ok(scene.mini.length > 0, `${piece.theme}/${piece.name} ${mood}`);
      }
    }
  },
);

test("a failed Cell holds its dazed face and a braced one its squeeze, still and unblinking", () => {
  for (const mood of ["crashed", "braced"] as const) {
    const scene = sceneFor(bare, mood, undefined, 0);
    NodeAssert.equal(scene.mini.length, 1, mood);
    NodeAssert.equal(scene.shut, undefined, mood);
  }
});

test("a long think shows the ponder and the head scratch in turn, twenty seconds each", () => {
  NodeAssert.equal(sceneFor(bare, "awake", "thinking", 5), sceneOf(bare, "thinking/0"));
  NodeAssert.equal(sceneFor(bare, "awake", "thinking", 25), sceneOf(bare, "thinking/1"));
  NodeAssert.equal(sceneFor(bare, "awake", "thinking", 45), sceneOf(bare, "thinking/0"));
});

test("held still, a Cell shows its first frame with its eyes open; on the clock, it blinks on its own moment", () => {
  const idle = sceneFor(bare, "awake", undefined, 0);
  NodeAssert.ok(idle.shut !== undefined, "the idle Cell blinks");
  NodeAssert.equal(frameShown(idle, "Otter", undefined, false), idle.mini[0]);
  const blink = (4000 * 7 + blinkStart("Otter", 7)) / 1000;
  NodeAssert.ok(idle.shut.mini.includes(frameShown(idle, "Otter", blink + 0.01, false)));
  NodeAssert.ok(idle.mini.includes(frameShown(idle, "Otter", blink - 0.01, false)));
  NodeAssert.ok(idle.mini.includes(frameShown(idle, "Otter", blink + 0.16, false)));
});

test("half a cell on whole device pixels draws the hero art, anything else the miniature", () => {
  const frame = sceneFor(bare, "awake", undefined, 0).mini[0]!;
  const density = (points: number, dpr: number) => pictureOf(frame, points, dpr).density;
  NodeAssert.deepEqual(
    [density(1, 2), density(2, 2), density(2, 1), density(2, 3), density(1, 4)],
    [2, 2, 2, 2, 2],
  );
  NodeAssert.deepEqual(
    [density(1, 1), density(1, 1.5), density(2, 1.5), density(1, 3)],
    [1, 1, 1, 1],
  );
  NodeAssert.equal(pictureOf(frame, 1, 2).rows, frame.drawn.detail);
});

test("a 2× display draws the original's widest pieces whole, past the box, and the box as it was", () => {
  const souwester = sceneFor(packLook(["autumn/souwester"]), "awake", undefined, 0).mini[0]!;
  const sharp = pictureOf(souwester, 1, 2).rows;
  const [x, y, w, h] = [MARGIN.x * 2, MARGIN.y * 2, BOX.width * 2, BOX.height * 2];
  NodeAssert.deepEqual(crop(sharp, x, y, w, h), souwester.detail, "the box, cell for cell");
  const brim = sharp.flatMap((row, ry) =>
    [...row].filter((cell, rx) => cell !== "." && (rx < x || rx >= x + w || ry < y || ry >= y + h)),
  );
  NodeAssert.ok(brim.length > 0, "the brim past the box");
  const small = pictureOf(souwester, 1, 1).rows;
  NodeAssert.deepEqual(crop(small, MARGIN.x, MARGIN.y, BOX.width, BOX.height), souwester.rows);
  NodeAssert.equal(
    small.join("").replace(/\./g, "").length,
    souwester.rows.join("").replace(/\./g, "").length,
  );
});

test("Codex, Kimi and Gemini wear their own bodies, every other provider the coral Cell", () => {
  NodeAssert.deepEqual(
    ["codex", "openai", "kimi", "moonshot", "gemini", "google", "claudeAgent", "cursor", null].map(
      bodyOf,
    ),
    ["codex", "codex", "kimi", "kimi", "gemini", "gemini", "claude", "claude", "claude"],
  );
  for (const body of ["codex", "kimi", "gemini", "claude"]) NodeAssert.ok(body in BODIES, body);
});
