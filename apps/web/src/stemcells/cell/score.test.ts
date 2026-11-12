import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { type ScoreMark, scored } from "./score.ts";

const REST_BASE = 29;
const star: ScoreMark = { art: ["*"], hotspot: [0, 0], mini: ["*"], miniHotspot: [0, 0] };
const liftOf = (frame: { pose: { base?: number } }) => REST_BASE - (frame.pose.base ?? REST_BASE);

test("a leap crouches, rises to its height, hangs, falls faster than it rose, and lands squashed", () => {
  const { frames, tell, problems } = scored([{ do: "leap", height: 6, tell: true }]);
  NodeAssert.deepEqual(problems, []);
  const lifts = frames.map(liftOf);
  const top = lifts.indexOf(6);
  const down = lifts.lastIndexOf(6);
  NodeAssert.equal(tell, top, "the height tells it");
  NodeAssert.ok((frames[0]!.pose.sy ?? 1) < 1 && lifts[0] === 0, "it crouches on the ground first");
  NodeAssert.ok(down - top >= 2, "it hangs");
  const rising = lifts.slice(0, top).filter((lift) => lift > 0).length;
  const falling = lifts.slice(down + 1).filter((lift) => lift > 0).length;
  NodeAssert.ok(falling < rising, `falls in ${falling}, rose in ${rising}`);
  const landed = frames[lifts.findLastIndex((lift) => lift > 0) + 1]!;
  NodeAssert.ok((landed.pose.sy ?? 1) < 1 && (landed.pose.spread ?? 0) > 0, "it lands squashed");
  NodeAssert.deepEqual(frames.at(-1)!.pose, {}, "and settles at rest");
});

test("what a score sets is carried until it is changed; a phrase's own arms and face last the phrase", () => {
  const { frames } = scored([
    { do: "face", eyes: "wide", look: [1, 0] },
    { do: "leap", height: 2, arms: "up", eyes: "squeeze", settle: false },
    { do: "hold" },
    { do: "rest" },
  ]);
  const inAir = frames.find((frame) => liftOf(frame) > 0)!;
  NodeAssert.equal(inAir.pose.eyes, "squeeze");
  NodeAssert.equal(inAir.pose.arms?.length, 2);
  const held = frames.at(-2)!;
  NodeAssert.deepEqual(held.pose, { eyes: "wide", look: [1, 0] });
  NodeAssert.deepEqual(frames.at(-1)!.pose, {});
});

test("a spin shows the back of the head and comes round to the front", () => {
  const { frames, tell } = scored([{ do: "spin", turns: 1, per: 8, tell: true }]);
  NodeAssert.equal(frames.length, 8);
  const backs = frames.flatMap((frame, i) => (frame.pose.eyes === "none" ? [i] : []));
  NodeAssert.deepEqual(backs, [2, 3, 4], "away for the far half of the turn");
  NodeAssert.equal(tell, 2);
  NodeAssert.ok((frames[0]!.pose.face ?? 0) > 0 && (frames[6]!.pose.face ?? 0) < 0);
  NodeAssert.deepEqual(frames.at(-1)!.pose, {}, "front again");
});

test("an arm travels out and home, and a hand holds its mark only at the end of its reach", () => {
  const { frames } = scored(
    [
      { do: "arms", right: "raised", rightHolds: "star" },
      { do: "hold", for: 2 },
      { do: "arms", right: null },
      { do: "rest" },
    ],
    { star },
  );
  const reach = frames.map((frame) => Math.abs(frame.pose.arms?.[0]?.dy ?? 0));
  NodeAssert.deepEqual(reach, [2, 4, 4, 2, 0]);
  NodeAssert.deepEqual(
    frames.map((frame) => frame.layers?.length ?? 0),
    [0, 1, 1, 0, 0],
  );
  NodeAssert.equal(frames[1]!.layers![0]!.attach, "handR");
});

test("a mark rides the frames it is given: from a landing, drifting, or circling the head", () => {
  const { frames } = scored(
    [
      { do: "leap", height: 4, settle: false },
      { do: "mark", mark: "star", on: "land", at: "ground", for: 2 },
      { do: "hold", for: 3 },
      { do: "mark", mark: "star", for: 3, dx: 4, drift: [2, -2] },
      { do: "orbit", mark: "star", count: 2, rx: 6, ry: 2, per: 4, for: 3 },
      { do: "hold", for: 3 },
    ],
    { star },
  );
  const landing = frames.findIndex(
    (frame, i) => i > 0 && liftOf(frame) === 0 && liftOf(frames[i - 1]!) > 0,
  );
  NodeAssert.equal(frames[landing]!.layers?.[0]?.attach, "ground");
  NodeAssert.equal(frames[landing + 2]!.layers, undefined, "two frames, no more");
  const last = frames.slice(-3).map((frame) => frame.layers!);
  NodeAssert.deepEqual(
    last.map((layers) => layers[0]!.hotspot),
    [
      [-4, 0],
      [-6, 2],
      [-8, 4],
    ],
    "the hotspot moves the other way: the art drifts right and up",
  );
  NodeAssert.deepEqual(
    last.map((layers) => layers.slice(1).map((layer) => layer.z)),
    [
      [5, 5],
      [5, -1],
      [5, 5],
    ],
    "in front on the near half of the ring, behind the head on the far",
  );
});

test("a score that names what there isn't says so, and plays the rest", () => {
  const { frames, problems } = scored(
    [
      { do: "moonwalk" },
      { do: "arms", left: "wing" },
      { do: "mark", mark: "comet", for: 2 },
      { do: "mark", mark: "star", on: "land", for: 2 },
      { do: "hold", for: 2 },
      { do: "mark", mark: "star", for: 2 },
    ],
    { star },
  );
  NodeAssert.equal(frames.length, 2);
  NodeAssert.deepEqual(problems, [
    "0 moonwalk: no such phrase",
    '1 arms: no arm "wing"',
    '3 mark: no phrase before it names "land"',
    '2 mark: no mark "comet"',
    "5 mark: no frame follows it to ride",
  ]);
});
