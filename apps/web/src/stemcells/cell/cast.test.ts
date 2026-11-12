import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { ACTIVITIES } from "./activity.ts";
import { blinkStart } from "./blink.ts";
import { bodyOf, entering, entranceOf, frameFor, frameShown, pictureOf, sceneFor } from "./cast.ts";
import { BODIES, PACKS } from "./kit.ts";
import { BOX, MOODS } from "./look.ts";
import { fidgetingFor, mannerOf, phaseOf } from "./manner.ts";
import { type CellScene, MARGIN, outfitLook, packLook, sceneOf } from "./scene.ts";
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

/** Whether `frame` is frame `index` of `scene`, eyes open or shut. */
const isFrame = (scene: CellScene, index: number, frame: unknown): boolean =>
  frame === scene.mini[index] || frame === scene.shut?.mini[index];

test("a landing's cheer plays once from its first frame, then the Cell rests with its eyes pleased", () => {
  const name = "Otter";
  const manner = mannerOf(name);
  const cheer = sceneOf(bare, manner.beats.landed ?? "happy")!;
  const rest = sceneOf(bare, `pleased/${manner.id}`)!;
  const since = 1000;
  const at = (seconds: number) =>
    frameFor(
      bare,
      { name, mood: "pleased", activity: undefined, entrance: { kind: "landed", since } },
      seconds,
    );
  const beat = 1 / cheer.fps;
  const noticed = since + manner.noticeMs / 1000;
  NodeAssert.ok(isFrame(cheer, 0, at(since)), "its first frame the moment it lands");
  for (const index of [0, 3, cheer.pass - 1])
    NodeAssert.ok(isFrame(cheer, index, at(noticed + (index + 0.5) * beat)), `frame ${index}`);
  const after = at(noticed + (cheer.pass + 0.5) * beat);
  NodeAssert.ok(
    rest.mini.includes(after) || rest.shut?.mini.includes(after),
    "once played, it rests: the cheer never loops",
  );
});

test("an outfit's own cheer wins over the Cell's manner, and held still it shows the frame that tells it", () => {
  const athlete = outfitLook("gym/athlete")!;
  const flex = sceneOf(athlete, "happy")!;
  const showing = {
    name: "Otter",
    mood: "pleased",
    activity: undefined,
    entrance: { kind: "landed", since: 50 },
  } as const;
  NodeAssert.ok(isFrame(flex, 0, frameFor(athlete, showing, 50)));
  NodeAssert.equal(frameFor(athlete, showing, undefined), flex.mini[flex.tell]);
  NodeAssert.ok(flex.tell > 0, "the flex, not the stance before it");
});

test("a cheer is one pass even while what the Cell wears goes on moving", () => {
  // A raincloud rains on a cycle of its own, which the original folds into a longer strip.
  const cloud = packLook(["house/raincloud"]);
  const manner = mannerOf("Otter");
  const cheer = sceneOf(cloud, manner.beats.landed ?? "happy")!;
  NodeAssert.ok(cheer.pass <= cheer.mini.length);
  const showing = {
    name: "Otter",
    mood: "pleased",
    activity: undefined,
    entrance: { kind: "landed", since: 0 },
  } as const;
  const after = frameFor(cloud, showing, manner.noticeMs / 1000 + (cheer.pass + 0.5) / cheer.fps);
  const rest = sceneOf(cloud, `pleased/${manner.id}`)!;
  NodeAssert.ok(rest.mini.includes(after) || rest.shut?.mini.includes(after));
});

test("a moment is entered once: a landing seen late is joined in progress, a send is taken up, a sleeper wakes", () => {
  const rest = { mood: "awake", working: false } as const;
  const work = { mood: "awake", working: true } as const;
  const pleased = { mood: "pleased", working: false } as const;
  const asleep = { mood: "asleep", working: false } as const;
  NodeAssert.deepEqual(entranceOf(work, pleased, 100, 99.8), { kind: "landed", since: 100 });
  NodeAssert.deepEqual(entranceOf(undefined, pleased, 100, 96), { kind: "landed", since: 96 });
  NodeAssert.equal(entranceOf(pleased, pleased, 101, 96), undefined);
  NodeAssert.deepEqual(entranceOf(rest, work, 7), { kind: "onIt", since: 7 });
  NodeAssert.deepEqual(entranceOf(pleased, work, 7), { kind: "onIt", since: 7 });
  NodeAssert.deepEqual(entranceOf({ mood: "needsYou", working: false }, work, 7), {
    kind: "answered",
    since: 7,
  });
  NodeAssert.deepEqual(entranceOf({ mood: "needsApproval", working: false }, work, 7), {
    kind: "granted",
    since: 7,
  });
  const crashed = { mood: "crashed", working: false } as const;
  NodeAssert.deepEqual(entranceOf(work, crashed, 7), { kind: "failed", since: 7 });
  NodeAssert.equal(entranceOf(crashed, crashed, 8), undefined);
  NodeAssert.equal(entranceOf(undefined, crashed, 8), undefined, "found failed, it just holds");
  NodeAssert.equal(entranceOf(work, work, 8), undefined);
  NodeAssert.equal(
    entranceOf({ mood: "meditating", working: true }, work, 8),
    undefined,
    "deep in thought, it was at work all along",
  );
  NodeAssert.equal(entranceOf(undefined, work, 8), undefined, "found at work, it just works");
  NodeAssert.deepEqual(entranceOf(asleep, rest, 9), { kind: "wake", since: 9 });
  NodeAssert.deepEqual(entranceOf(rest, asleep, 9), { kind: "sleep", since: 9 });
  NodeAssert.deepEqual(
    entranceOf(work, pleased, 100, 90),
    { kind: "landed", since: 100 },
    "a picture that watched it land cheers from the top, whatever the clocks say",
  );
});

test("every picture of a Cell plays a moment in step: one that appears mid-move joins it", () => {
  const rest = { mood: "awake", working: false } as const;
  const work = { mood: "awake", working: true } as const;
  const pleased = { mood: "pleased", working: false } as const;
  const taken = entering("Heron", rest, work, 50);
  NodeAssert.deepEqual(taken, { kind: "onIt", since: 50 });
  NodeAssert.equal(entering("Heron", rest, work, 50.2), taken, "a second picture, a beat later");
  NodeAssert.equal(entering("Heron", undefined, work, 50.6), taken, "a pane opened mid-move");
  NodeAssert.equal(
    entering("Heron", work, work, 51),
    undefined,
    "nothing begins: it keeps its own",
  );
  const cheer = entering("Heron", work, pleased, 60, 59.9);
  NodeAssert.deepEqual(cheer, { kind: "landed", since: 60 });
  NodeAssert.equal(entering("Heron", undefined, pleased, 61, 59.9), cheer, "opened a second on");
  NodeAssert.equal(entering("Heron", undefined, pleased, 63, 59.9), cheer, "and found it later");
  NodeAssert.equal(entering("Heron", undefined, rest, 70), undefined, "the cheer is over");
  NodeAssert.deepEqual(
    entering("Heron", work, pleased, 90, 89.9),
    { kind: "landed", since: 90 },
    "the next landing is its own moment",
  );
});

test("an entrance belongs to the state it entered: a cheer left for work is dropped", () => {
  const landed = { kind: "landed", since: 10 } as const;
  const frame = frameFor(
    bare,
    { name: "Otter", mood: "awake", activity: "reading", entrance: landed },
    10.1,
  );
  const reading = sceneOf(bare, "reading/0")!;
  NodeAssert.ok(reading.mini.includes(frame) || reading.shut?.mini.includes(frame));
});

test("every Cell keeps one manner for life, a crew holds all six, and at rest no two stand on the same beat", () => {
  const crew = Array.from({ length: 60 }, (_, i) => `thread-${i}`);
  NodeAssert.equal(new Set(crew.map((name) => mannerOf(name).id)).size, 6);
  for (const name of crew.slice(0, 6)) NodeAssert.equal(mannerOf(name), mannerOf(name));
  NodeAssert.ok(new Set(crew.slice(0, 12).map(phaseOf)).size >= 11);
});

test("a rest is painted only when its pose changes: frames of one pose are one picture", () => {
  for (const name of ["thread-0", "thread-1", "thread-2", "thread-3"]) {
    const manner = mannerOf(name);
    const rest = sceneOf(bare, `rest/${manner.id}`)!;
    const poses = new Set(rest.hero.map((rows) => rows.join("\n"))).size;
    NodeAssert.equal(new Set(rest.mini).size, poses, manner.id);
    NodeAssert.ok(poses < rest.mini.length, `${manner.id} holds its poses`);
  }
});

test("a Cell at rest fidgets now and then, and only while the person is there", () => {
  const name = "thread-0";
  const manner = mannerOf(name);
  const fidget = sceneOf(bare, manner.fidget!)!;
  const rest = sceneOf(bare, `rest/${manner.id}`)!;
  let seconds = 0;
  while (fidgetingFor(name, seconds) === undefined) seconds += 1;
  const start = seconds - fidgetingFor(name, seconds)!;
  const showing = { name, mood: "awake", activity: undefined } as const;
  const there = frameFor(bare, { ...showing, here: true }, start + 0.01);
  NodeAssert.ok(isFrame(fidget, 0, there), "its fidget's first frame");
  const away = frameFor(bare, showing, start + 0.01);
  NodeAssert.ok(rest.mini.includes(away) || rest.shut?.mini.includes(away));
  const windows = Array.from({ length: 400 }, (_, w) => fidgetingFor(name, w * 90 + 89));
  const held = windows.filter((since) => since !== undefined).length;
  NodeAssert.ok(held > 50 && held < 150, `${held} of 400 windows hold a fidget`);
});
